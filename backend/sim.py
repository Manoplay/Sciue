import json
import random
import threading
import time
import paho.mqtt.client as mqtt

# Configurazione Broker MQTT
BROKER = "localhost"
PORT = 1883

NUM_PARKINGS = 5
CYCLES_PER_PARKING = 1

# Stato condiviso per i 5 stalli: {1: False, 2: False, ...}
parking_states = {pid: False for pid in range(1, NUM_PARKINGS + 1)}
state_lock = threading.Lock()


def get_magnetic_reading(parking_id: int, is_occupied: bool) -> dict:
    """Genera valori magnetici (in microTesla) per lo specifico stallo."""
    if is_occupied:
        bx = round(random.uniform(75.0, 95.0), 2)
        by = round(random.uniform(-45.0, -30.0), 2)
        bz = round(random.uniform(120.0, 160.0), 2)
    else:
        bx = round(random.uniform(20.0, 24.0), 2)
        by = round(random.uniform(-5.0, -2.0), 2)
        bz = round(random.uniform(40.0, 44.0), 2)

    return {
        "parking_id": parking_id,
        "sensor": "magnetometer",
        "x_uT": bx,
        "y_uT": by,
        "z_uT": bz,
        "timestamp": round(time.time(), 2),
    }


def get_radar_reading(parking_id: int, is_occupied: bool) -> dict:
    """Genera una lettura radar (distanza in cm) per lo specifico stallo."""
    if is_occupied:
        distance_cm = round(random.uniform(25.0, 45.0), 1)
        confidence = round(random.uniform(0.92, 0.99), 2)
    else:
        distance_cm = round(random.uniform(220.0, 250.0), 1)
        confidence = round(random.uniform(0.85, 0.95), 2)

    return {
        "parking_id": parking_id,
        "sensor": "radar",
        "distance_cm": distance_cm,
        "object_detected": is_occupied,
        "confidence": confidence,
        "timestamp": round(time.time(), 2),
    }


def on_connect(client, userdata, flags, reason_code, properties=None):
    print(f"[MQTT] Connesso al broker ({reason_code})")
    # Sottoscrizione wildcard (+) per ascoltare il radar di tutti i 5 stalli
    client.subscribe("/sensors/+/radar")
    print("[MQTT] In ascolto su '/sensors/+/radar' per i comandi START...")


def on_message(client, userdata, msg):
    parts = msg.topic.strip("/").split("/")
    # Verifica che il topic rispetti il formato sensors/<id>/radar
    if len(parts) == 3 and parts[0] == "sensors" and parts[2] == "radar":
        try:
            parking_id = int(parts[1])
            if parking_id not in parking_states:
                return

            payload = json.loads(msg.payload.decode("utf-8"))

            if payload.get("action") == "start":
                print(f"\n[RADAR #{parking_id}] Ricevuto START -> Scansione in corso...")
                with state_lock:
                    occupied = parking_states[parking_id]

                radar_data = get_radar_reading(parking_id, occupied)
                topic_radar = f"/sensors/{parking_id}/radar"
                client.publish(topic_radar, json.dumps(radar_data))
                print(f"[RADAR #{parking_id}] Pubblicato su {topic_radar}: {radar_data}\n")

        except (ValueError, json.JSONDecodeError) as e:
            print(f"[ERRORE] Messaggio non valido su {msg.topic}: {e}")


def simulate_single_parking(client: mqtt.Client, parking_id: int, cycles: int):
    """Thread indipendente che simula i cicli di entrata/uscita di un singolo stallo."""
    topic_magnetic = f"/sensors/{parking_id}/magnetic"

    # Sfalsamento iniziale (0 - 3s) per evitare traffico sincronizzato identico
    time.sleep(random.uniform(0.0, 3.0))

    for cycle in range(1, cycles + 1):
        # 1. Stallo libero per 4 secondi prima dell'ingresso
        with state_lock:
            parking_states[parking_id] = False
        print(f"[STALLO #{parking_id} | Ciclo {cycle}/{cycles}] LIBERO (4s)")

        for _ in range(4):
            mag_data = get_magnetic_reading(parking_id, False)
            client.publish(topic_magnetic, json.dumps(mag_data))
            time.sleep(1)

        # 2. L'auto entra e resta parcheggiata per 10 secondi
        with state_lock:
            parking_states[parking_id] = True
        print(f"[STALLO #{parking_id} | Ciclo {cycle}/{cycles}] OCCUPATO (10s)")

        for _ in range(10):
            mag_data = get_magnetic_reading(parking_id, True)
            client.publish(topic_magnetic, json.dumps(mag_data))
            time.sleep(1)

        # 3. L'auto esce
        with state_lock:
            parking_states[parking_id] = False
        print(f"[STALLO #{parking_id} | Ciclo {cycle}/{cycles}] AUTO USCITA")

    print(f"--> Simulazione completata per STALLO #{parking_id}.")


if __name__ == "__main__":
    client = mqtt.Client(
        mqtt.CallbackAPIVersion.VERSION2,
        client_id="smart_parking_sim_fleet",
    )
    client.on_connect = on_connect
    client.on_message = on_message

    client.connect(BROKER, PORT, keepalive=60)
    client.loop_start()

    threads = []
    try:
        time.sleep(1)
        # Avvia un thread parallelo per ciascuno dei 5 parcheggi (ID 0..4)
        for pid in range(0, NUM_PARKINGS):
            t = threading.Thread(
                target=simulate_single_parking,
                args=(client, pid, CYCLES_PER_PARKING),
                daemon=True,
            )
            threads.append(t)
            t.start()

        # Attende la conclusione di tutti i 5 thread
        for t in threads:
            t.join()

        print("\nTutte le simulazioni sui 5 parcheggi sono terminate.")

    except KeyboardInterrupt:
        print("\nInterruzione manuale rilevata.")
    finally:
        time.sleep(5)
        client.loop_stop()
        client.disconnect()
        print("[MQTT] Disconnesso.")