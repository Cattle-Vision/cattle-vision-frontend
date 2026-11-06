# CattleVision Frontend (`cattle-vision-frontend`)

Aplicação cliente PWA construída em **Next.js 16 (App Router)**, **React 19** e **Tailwind CSS**, especializada na coleta fotográfica anatômica padronizada e criação de dataset colaborativo para treinamento da Inteligência Artificial de Índice de Condição Corporal Bovino (ICS / ECC).

---

## 🚀 Arquitetura Desacoplada e Comunicação Cross-Origin

O frontend opera de maneira 100% desacoplada do backend (`cattle-vision-backend`):
- **Cross-Origin / Multi-Servidor**: Pode ser hospedado na Vercel (`https://cattle-vision-frontend.vercel.app`), em um servidor Docker dedicado, ou em computadores locais na mesma rede Wi-Fi.
- **Variável de Conexão com API**: Comunica-se com o backend através da variável de ambiente `NEXT_PUBLIC_API_URL` (ex: `http://192.168.1.100:3001` ou `https://api.meusite.com`).
- **Autenticação Stateless**: Utiliza tokens JWT armazenados no cliente e injetados via header `Authorization: Bearer <token>` em todas as requisições à API.
- **Renderização Segura de Mídia**: Todas as imagens e miniaturas apontam dinamicamente para `${NEXT_PUBLIC_API_URL}/api/photos/[id]`, permitindo visualização de imagens mesmo com servidores remotos ou storages privados.

---

## 🛠️ Tecnologias e Recursos

- **Next.js 16** com React 19 e Tailwind CSS.
- **Câmera Guiada com IA em Tempo Real**: Viewfinder com silhueta anatômica bovina (garupa e ísquios) e cálculo contínuo de nitidez e enquadramento.
- **Diagnóstico Pré-Upload**: Avalia o Score de Confiança IA antes do salvamento definitivo.
- **Design System AgTech**: Suporte completo a Modo Claro e Modo Escuro, safe-area mobile e responsividade ergonômica para uso em currais.
- **Modais e Toasts Internos**: Substituição total de popups nativos do navegador (`window.confirm` e `window.alert`) por componentes fluidos.
- **Suporte Offline / PWA**: Registro de Service Worker e fila offline com IndexedDB (`idb`).

---

## ⚙️ Variáveis de Ambiente (`.env.local`)

| Variável | Descrição | Exemplo Padrão |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | URL base do servidor de API backend | `http://localhost:3001` |

---

## 📦 Implantação e Deploy

### 1. Vercel
1. Conecte este repositório à Vercel.
2. Defina a variável de ambiente:
   - `NEXT_PUBLIC_API_URL`: URL do seu backend implantado na Vercel (ex: `https://cattle-vision-backend.vercel.app`).
3. Deploy imediato com suporte a rotas estáticas e PWA.

### 2. Docker
```bash
# Build da imagem passando a URL da API
docker build --build-arg NEXT_PUBLIC_API_URL="http://192.168.1.100:3001" -t cattle-vision-frontend .

# Execução do container na porta 3000
docker run -d -p 3000:3000 --name cattle-frontend cattle-vision-frontend
```

Ou usando Docker Compose:
```bash
docker compose up -d
```
