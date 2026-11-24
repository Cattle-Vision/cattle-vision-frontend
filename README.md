# CattleVision Frontend

Interface web progressiva (PWA) da plataforma **CattleVision**, projetada com o design system **Agro Precisão** para manejo zootécnico em campo, identificação de bovinos, captura anatômica guiada e acompanhamento do **Índice de Condição Corporal (ICS)**.

> **Importante — Diferença entre CattleVision e CattleCapture**
>
> | Aspecto | **CattleVision** (`cattle-vision-frontend` + `cattle-vision-backend`) | **CattleCapture** (`cattle-capture`) |
> |---|---|---|
> | **Finalidade principal** | **Avaliação zootécnica completa com escore corporal (ICS)** | **Captura padronizada e curadoria de dataset zootécnico** |
> | **IA de Identificação / Enquadramento (`identifier.onnx` + guardas)** | **Sim** (Edge ONNX no navegador + validação no backend) | **Sim** (Edge ONNX no navegador + validação no servidor) |
> | **IA de Avaliação de ICS (`YOLO26m` / Escala 1,0–5,0)** | **Sim** (fila assíncrona `IcsJob`, painel ICS por animal e inspeção por foto) | **Não possui** (removida por definição de produto) |
> | **Prontuário, Saúde, GPS, Guarda Compartilhada, BLE RFID & Offline PWA** | **Sim** | **Sim** |
>
> Resumindo: o **CattleVision** possui todas as funcionalidades de coleta e prontuário **mais a IA de cálculo de ICS (`YOLO26m`)**, enquanto o **CattleCapture** concentra-se exclusivamente na captura e curadoria de datasets sem inferência ou interface de ICS.

---

## Arquitetura e Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Estilização**: Tailwind CSS 4 ("Agro Precisão", suporte a Light/Dark Mode e layout mobile-first para uso no tronco/curral)
- **Offline & PWA**: IndexedDB (`idb`) + Service Worker (`/sw.js`) + `SyncManager` para fila automática offline
- **Edge AI (Cliente)**: `onnxruntime-web` rodando localmente `identifier.onnx` + guardas semânticos (`version-RFB-320.onnx`, `yolo11n.onnx`) para pré-enquadramento em tempo real (`300ms`) e validação pré-upload
- **Hardware BLE**: Web Bluetooth (`bluetooth-rfid.ts`) compatível com leitor RFID ESP32 (`CattleVision-RFID` / `finalesp`)
- **Comunicação**: Cliente REST desacoplado (`src/lib/api.ts`) consumindo o `cattle-vision-backend` via JWT

---

## Principais Módulos

- **Painel do Rebanho (`/dashboard`)**: Busca rápida, filtros (Meus, Compartilhados, Com/Sem fotos), resumo do lote e badges de ICS.
- **Identificação Rápida (`/identify`)**: Busca por apelido, brinco ou aproximação de tag via leitor RFID BLE.
- **Câmera Guiada (`/camera`)**: Retícula anatômica e inferência ONNX em tempo real antes do envio para avaliação de ICS.
- **Prontuário Completo (`/animal/[id]`)**:
  - Painel de **ICS** com escala visual 1,0 a 5,0, histórico e disparo manual/em fila.
  - Histórico de localização/piquete com coordenadas GPS, vacinas, histórico clínico de doenças e observações.
  - Guarda compartilhada com colaboradores e transferência de titularidade.
- **Painel Administrativo (`/admin`)**: Exportação do dataset ZIP, reavaliação de enquadramento, regeração em fila do ICS do rebanho e gestão de usuários.

---

## Desenvolvimento Local

```bash
npm install
npm run dev
```

Variável principal:
- `NEXT_PUBLIC_API_URL`: URL base da API do `cattle-vision-backend` (ex.: `http://localhost:4000` ou domínio de produção).
