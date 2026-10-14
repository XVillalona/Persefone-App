# Perséfone • Aviation Ground Handling & Billing Audit System

Sistema moderno de auditoría y facturación determinista para operaciones de rampa aeroportuarias (Formulario F-RAM-AVL-MAG 04).

## Características Principales

1. **Pantalla de Carga de Rampa Progresiva (0% a 100%)**:
   - Visualización del Boeing 737 MAX de Arajet.
   - Acoplamiento secuencial de equipos de tierra (GSE):
     - **0% - 18%**: Calzos y conos de delimitación perimetral.
     - **19% - 38%**: Unidad eléctrica de tierra GPU 400Hz (Ground Power Unit) y cable umbilical.
     - **39% - 60%**: Escalera autopropulsada acoplada a puerta L1 con barandas de seguridad.
     - **61% - 82%**: Cinta transportadora de equipajes (Belt Loader) con valijas en tránsito y tren de carritos.
     - **83% - 100%**: Remolcador de empuje heavy-duty (Pushback Tug & Towbar) con señal de listo para despacho.
   - Modo interactivo: Simulador accesible desde el header con controles de velocidad (1x, 2x, 4x), pausa y barra de tiempo.

2. **Soporte Multi-HUB (PUJ vs SDQ)**:
   - Selector de estación de operaciones:
     - **PUJ**: Aeropuerto Internacional de Punta Cana (MDPC).
     - **SDQ**: Aeropuerto Internacional Las Américas (MDSD).
   - Filtrado contextual de órdenes de servicio por HUB.
   - Paso previo obligatorio en la carga de lotes PDF para asociar cada orden al HUB correcto.

3. **Motor Determinista de Liquidación**:
   - Turnaround contractual de 70 minutos sin recargo.
   - Facturación automática de tiempo en exceso por bloques de 15 minutos ($125 USD).
   - Recargo nocturno (22:00 - 06:00) del 20% y días festivos dominicanos (50%).
   - Auditoría de servicios adicionales (GPU, escaleras extras, remolque demorado, etc.).

4. **Monitoreo de KPI Arajet (Concesión 3)**:
   - Seguimiento del umbral mínimo de 226 vuelos/mes con promedio móvil de 4 meses para tarifas preferenciales.
