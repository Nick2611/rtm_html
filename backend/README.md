Backend notes for this repo

- `backend/lambda/send-email/` contains the local source for the contact-form Lambda.
- The static site deployed from Amplify only publishes the files listed in `amplify.yml`, so this folder stays out of the web root on purpose.
- The live frontend currently posts directly to the deployed API Gateway endpoint configured in `js/main.js`.

## Clics de WhatsApp con código de referencia (conversiones offline)

Para que Google Ads optimice por mensajes que llegan, y no por toques al botón:

1. `js/conversion-tracking.js` guarda el `gclid`/`gbraid`/`wbraid` al aterrizar (localStorage,
   90 días), agrega `· #K7Q3M` a la marca del mensaje de WhatsApp y manda un beacon a la misma
   Lambda del formulario con `event: "whatsapp_click"`. Sólo desde `pantallasledrtm.com`.
2. La Lambda (`whatsapp-click.js`) valida y guarda en `s3://rtm-leads-raw/whatsapp-clicks/`.
   Nunca manda mail y nunca pasa por la validación del formulario.
3. Quien atiende anota el código de cada mensaje en la planilla de conversaciones.
4. `scripts/ads/subir-conversiones-offline.py` cruza planilla y clics y sube a Google Ads
   "WhatsApp - mensaje real", "cotización enviada" y "venta".

### Despliegue (en este orden)

```bash
# 1. Bucket: prefijo nuevo, retención de 120 días y permisos. Revisar el change set antes.
aws cloudformation describe-stacks --query "Stacks[].StackName"   # ubicar el stack del bucket
aws cloudformation deploy --template-file backend/infra/leads-bucket.yaml \
  --stack-name <stack-del-bucket> --capabilities CAPABILITY_NAMED_IAM --no-execute-changeset

# 2. Lambda: el zip ya está regenerado.
aws lambda update-function-code --function-name <lambda-del-formulario> \
  --zip-file fileb://backend/lambda/send-email/send-email.zip

# 3. Probar el endpoint como lo hace un beacon (text/plain). Esperado: 202.
curl -si -X POST https://2j77uv25gk.execute-api.us-east-1.amazonaws.com/Prod/send-email \
  -H 'Content-Type: text/plain;charset=UTF-8' \
  -d '{"event":"whatsapp_click","ref":"TEST2","placement":"prueba","context":{"page":"/prueba.html"}}'

# 4. Acciones de conversión (nacen SECUNDARIAS: no tocan la puja).
python3 scripts/ads/crear-acciones-offline.py            # validateOnly
python3 scripts/ads/crear-acciones-offline.py --aplicar

# 5. Sitio: publicar js/conversion-tracking.js y las 20 páginas con ?v=20260917-ref1.
```

### Uso diario

```bash
python3 scripts/ads/subir-conversiones-offline.py --planilla conversaciones.csv --sync --solo-cruce
python3 scripts/ads/subir-conversiones-offline.py --planilla conversaciones.csv --aplicar
```

Pruebas: `node --test` en `backend/lambda/send-email/` y en `js/`, y
`python3 -m unittest scripts/ads/test_subir_conversiones.py`.
