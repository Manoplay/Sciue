# Questa funzione suppone che esista una matrice di sensori
# che comunica con un broker MQTT. La funzione si connette al broker, riceve i dati dai sensori e li elabora.
import json
import sys
import threading
import time

import paho.mqtt.client as mqtt

STATE_EMPTY = 0
STATE_AWAIT_CONFIRM = 1
STATE_OCCUPIED = 2

THRESHOLD_MAGNETIC = 50.0  # Soglia per rilevare un oggetto con il sensore magnetico
CALIBRATED_BASELINE = (0.0, 0.0, 0.0)  # Valori di base calibrati per il sensore magnetico

states = [STATE_EMPTY] * 5
state_lock = threading.Lock()


def render_grid():
    """Aggiorna continuamente la griglia degli stalli nel terminale."""
    symbols = {
        STATE_EMPTY: ("\033[90m", "  LIBERO  "),
        STATE_AWAIT_CONFIRM: ("\033[33m", " CONFERMA "),
        STATE_OCCUPIED: ("\033[32m", "OCCUPATO  "),
    }

    while True:
        with state_lock:
            current_states = states.copy()

        blink_on = int(time.monotonic() * 2) % 2 == 0
        cells = []
        for parking_id, state in enumerate(current_states):
            color, label = symbols[state]
            if state == STATE_AWAIT_CONFIRM and not blink_on:
                color = "\033[90m"
                label = "          "
            cells.append(f"{color}[ {parking_id}: {label} ]\033[0m")

        rows = ["  ".join(cells[index:index + 3]) for index in range(0, len(cells), 3)]
        output = "\033[2J\033[H" + "SMART PARKING\n\n" + "\n\n".join(rows) + "\n"
        sys.stdout.write(output)
        sys.stdout.flush()
        time.sleep(0.5)


def set_state(parking_id, state):
    with state_lock:
        states[parking_id] = state


def on_message(client, userdata, msg):
    # Qui puoi elaborare il messaggio ricevuto dai sensori
    parking_id = int(msg.topic.split('/')[2])  # Estrai l'ID dello stallo dal topic
    sensor = msg.topic.split('/')[3]  # Estrai il tipo di sensore dal topic
    payload = json.loads(msg.payload.decode('utf-8'))
    with state_lock:
        current_state = states[parking_id]

    if current_state == STATE_EMPTY:
        if sensor == "magnetic":
            x_uT, y_uT, z_uT = payload["x_uT"], payload["y_uT"], payload["z_uT"]
            x_baseline, y_baseline, z_baseline = CALIBRATED_BASELINE
            deltaB = ((x_uT - x_baseline) ** 2 + (y_uT - y_baseline) ** 2 + (z_uT - z_baseline) ** 2) ** 0.5
            if deltaB > THRESHOLD_MAGNETIC:  # Soglia per rilevare un oggetto
                set_state(parking_id, STATE_AWAIT_CONFIRM)
                print(f"Stallo {parking_id} in attesa di conferma (magnetico).")
                client.publish(f"/sensors/{parking_id}/radar", json.dumps({"action": "start"}))
    elif current_state == STATE_AWAIT_CONFIRM:
        if sensor == "radar" and not payload.get("action"):
            object_detected = payload["object_detected"]
            if object_detected:
                set_state(parking_id, STATE_OCCUPIED)
                print(f"Stallo {parking_id} occupato (conferma radar).")
            else:
                set_state(parking_id, STATE_EMPTY)
                print(f"Stallo {parking_id} vuoto (conferma radar).")
    elif current_state == STATE_OCCUPIED:
        if sensor == "magnetic":
            x_uT, y_uT, z_uT = payload["x_uT"], payload["y_uT"], payload["z_uT"]
            x_baseline, y_baseline, z_baseline = CALIBRATED_BASELINE
            deltaB = ((x_uT - x_baseline) ** 2 + (y_uT - y_baseline) ** 2 + (z_uT - z_baseline) ** 2) ** 0.5
            if deltaB < THRESHOLD_MAGNETIC:  # Soglia per rilevare che l'oggetto è stato rimosso
                set_state(parking_id, STATE_AWAIT_CONFIRM)
                print(f"Stallo {parking_id} in attesa di conferma (magnetico).")
                client.publish(f"/sensors/{parking_id}/radar", json.dumps({"action": "start"}))


threading.Thread(target=render_grid, daemon=True).start()

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
client.on_message = on_message
client.connect("localhost", 1883, 60)
client.subscribe("/sensors/+/magnetic")
client.subscribe("/sensors/+/radar")
client.loop_forever()