# Da applicare su una telecamera che punta una strada dove passano autobus.

import cv2
from ultralytics import YOLO
from rapidocr_onnxruntime import RapidOCR
import pandas as pd

files = [
    "./routes_anm.csv",
    "./routes_eav.csv"
]

general_routes_df = pd.DataFrame()

for file in files:
    df = pd.read_csv(file)
    general_routes_df = pd.concat([general_routes_df, df], ignore_index=True)

model = YOLO("yolo26n.pt")
ocr = RapidOCR()
last_count = 0

def clean_allowed_characters(text):
    if not text:
        return ""
    allowed_characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    cleaned_text = ''.join(c for c in text if c.upper() in allowed_characters)
    return cleaned_text

cap = cv2.VideoCapture(1)

while cap.isOpened():
    success, frame = cap.read()
    if not success:
        break

    # 5 = autobus
    results = model.predict(frame, classes=[5], conf=0.5, stream=True, verbose=False)

    for r in results:
        annotated_frame = r.plot()
        if len(r.boxes) > last_count:
            print(f"Bus rilevato! Quantità: {len(r.boxes)}")
            for box in r.boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                frame_crop = frame[y1:y2, x1:x2]
                upscaled = cv2.resize(frame_crop, (0, 0), fx=2, fy=2, interpolation=cv2.INTER_LANCZOS4)
                grigio = cv2.cvtColor(upscaled, cv2.COLOR_BGR2GRAY)
                sfocato = cv2.GaussianBlur(grigio, (5, 5), 0)
                _, solo_led = cv2.threshold(sfocato, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                immagine_per_ocr = cv2.bitwise_not(solo_led)
                results, _ = ocr(immagine_per_ocr)
                if results:
                    for result in results:
                        if result is None: 
                            continue
                        if len(result) == 2:
                            text = result[0]
                            confidenza = result[1]
                        elif len(result) == 3:
                            text = result[1]
                            confidenza = result[2]
                        else:
                            continue
                        text = clean_allowed_characters(text)
                        if text and text != "":
                            print(f"Testo rilevato: {text} (Confidenza: {confidenza:.2f})")
                            # Controlla se il testo rilevato corrisponde a una linea di autobus nel DataFrame
                            # è permesso che il testo sia tipo 162S ma il nome vero del bus sia 162 quindi si fa un controllo se il testo rilevato contiene il nome della linea
                            matching_routes = general_routes_df[general_routes_df['route_short_name'].apply(lambda x: str(x) in text)]
                            if not matching_routes.empty:
                                print(f"Linea di autobus corrispondente trovata: {matching_routes['route_short_name'].values[0]}")
                            else:
                                print("Nessuna linea di autobus corrispondente trovata.")

        last_count = len(r.boxes)

        # Mostra il video a schermo
        cv2.imshow("Riconoscimento Bus - Tempo Reale", annotated_frame)

    # Premi il tasto 'q' per chiudere la finestra
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

# Rilascia la fotocamera e chiudi tutto
cap.release()
cv2.destroyAllWindows()