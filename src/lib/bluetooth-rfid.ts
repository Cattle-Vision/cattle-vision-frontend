/**
 * Módulo de Comunicação Web Bluetooth para Leitor RFID Bovino ESP32 (`src/lib/bluetooth-rfid.ts`).
 *
 * Arquitetura:
 * - Utiliza a Web Bluetooth API (`navigator.bluetooth`) para pareamento seguro direto pelo navegador.
 * - Conecta-se ao GATT Server do dispositivo ESP32 ("CattleVision-RFID").
 * - Escuta notificações assíncronas na característica GATT configurada.
 * - Decodifica tags EPC UHF de 12 bytes (24 caracteres hexadecimais em maiúsculo).
 * - Realiza debouncing de 2.5s para evitar leituras duplicadas involuntárias no curral.
 * - Provê feedback sonoro via Web Audio API (tons sintetizados sem necessidade de arquivos mp3 externos)
 *   e feedback tátil via `navigator.vibrate` em smartphones.
 * - Suporta fallback gracioso para navegadores sem suporte (ex: Safari iOS padrão),
 *   orientando navegadores compatíveis (Chrome Android, Edge, Bluefy no iOS) ou acionando modal de simulação.
 */

export const RFID_SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
export const RFID_CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

export type BluetoothStatus =
  | "unsupported"
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface RfidEventDetail {
  tag: string;
  timestamp: number;
  source: "ble" | "manual" | "simulation";
}

type TagListener = (detail: RfidEventDetail) => void;
type StatusListener = (status: BluetoothStatus, deviceName?: string, errorMsg?: string) => void;

class BluetoothRfidService {
  private device: any = null;
  private characteristic: any = null;
  private status: BluetoothStatus = "disconnected";
  private deviceName: string = "";
  private lastTag: string = "";
  private lastTagTime: number = 0;
  private tagListeners: Set<TagListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private audioCtx: AudioContext | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      if (!("bluetooth" in navigator)) {
        this.status = "unsupported";
      }
    }
  }

  /**
   * Verifica se o navegador atual suporta a Web Bluetooth API.
   */
  public isSupported(): boolean {
    return typeof window !== "undefined" && "bluetooth" in navigator;
  }

  public getStatus(): BluetoothStatus {
    return this.status;
  }

  public getDeviceName(): string {
    return this.deviceName;
  }

  /**
   * Registra listener para novas leituras de RFID.
   */
  public onTag(listener: TagListener): () => void {
    this.tagListeners.add(listener);
    return () => this.tagListeners.delete(listener);
  }

  /**
   * Registra listener para alterações de status de conexão Bluetooth.
   */
  public onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status, this.deviceName);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(status: BluetoothStatus, errorMsg?: string) {
    this.status = status;
    this.statusListeners.forEach((l) => l(status, this.deviceName, errorMsg));
  }

  /**
   * Emite feedback sonoro sintético no alto-falante do celular/computador.
   */
  public playAudioFeedback(type: "read" | "success" | "alert" | "disconnect") {
    try {
      if (typeof window === "undefined") return;
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }

      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;

      if (type === "read") {
        // Bipe agudo curto de leitura de tag (880 Hz - A5)
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === "success") {
        // Bipe duplo harmônico ascendente (Identificação confirmada / Guarda Compartilhada)
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.18);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === "alert") {
        // Tom grave de atenção (Animal não cadastrado / Atenção)
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.linearRampToValueAtTime(330, now + 0.25);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === "disconnect") {
        // Tom suave descendente
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.linearRampToValueAtTime(300, now + 0.15);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      }
    } catch {
      // Ignora silenciosamente se o navegador bloquear autoplay de áudio
    }
  }

  /**
   * Vibração tátil no celular do operador.
   */
  public triggerHaptic(pattern: number[] = [100]) {
    try {
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(pattern);
      }
    } catch {
      // Sem suporte à vibração
    }
  }

  /**
   * Inicia o pareamento com o dispositivo ESP32 via Web Bluetooth.
   * IMPORTANTE: Deve ser chamado diretamente em resposta a um gesto do usuário (clique no botão).
   */
  public async connect(): Promise<boolean> {
    if (!this.isSupported()) {
      this.setStatus("unsupported", "Web Bluetooth não é suportado neste navegador.");
      return false;
    }

    try {
      this.setStatus("connecting");

      // Solicita ao navegador a janela de escolha de dispositivos BLE
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          { namePrefix: "CattleVision" },
          { namePrefix: "ESP32" },
          { namePrefix: "RFID" },
        ],
        optionalServices: [RFID_SERVICE_UUID],
      });

      this.device = device;
      this.deviceName = device.name || "Leitor RFID ESP32";

      // Listener para desconexão acidental
      device.addEventListener("gattserverdisconnected", () => {
        this.setStatus("disconnected");
        this.playAudioFeedback("disconnect");
        this.characteristic = null;
      });

      // Conecta ao GATT Server do ESP32
      const server = await device.gatt.connect();

      // Obtém o serviço primário
      const service = await server.getPrimaryService(RFID_SERVICE_UUID);

      // Obtém a característica de notificação da tag
      const characteristic = await service.getCharacteristic(RFID_CHARACTERISTIC_UUID);
      this.characteristic = characteristic;

      // Ativa as notificações do ESP32
      await characteristic.startNotifications();

      characteristic.addEventListener(
        "characteristicvaluechanged",
        (event: any) => this.handleCharacteristicValue(event)
      );

      this.setStatus("connected");
      this.playAudioFeedback("success");
      this.triggerHaptic([80, 50, 80]);

      return true;
    } catch (err: any) {
      console.warn("[BluetoothRfid] Falha na conexão:", err);
      // O usuário pode ter cancelado a janela de pareamento
      if (err.name === "NotFoundError" || err.message?.includes("User cancelled")) {
        this.setStatus("disconnected");
      } else {
        this.setStatus("error", err.message || "Erro ao conectar ao leitor RFID.");
      }
      return false;
    }
  }

  /**
   * Desconecta manualmente do dispositivo ESP32.
   */
  public disconnect(): void {
    if (this.device && this.device.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.setStatus("disconnected");
    this.device = null;
    this.characteristic = null;
  }

  /**
   * Processa o payload binário emitido pelo ESP32 via notificação BLE.
   */
  private handleCharacteristicValue(event: any) {
    const value: DataView = event.target.value;
    if (!value || value.byteLength === 0) return;

    // Decodifica a string ASCII enviada pelo ESP32
    const decoder = new TextDecoder("utf-8");
    const rawString = decoder.decode(value);

    // Limpa quebras de linha e caracteres espúrios
    const cleanTag = rawString.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

    if (!cleanTag) return;

    // Debounce: ignora se a mesma tag foi lida nos últimos 2.5 segundos
    const now = Date.now();
    if (cleanTag === this.lastTag && now - this.lastTagTime < 2500) {
      return;
    }

    this.lastTag = cleanTag;
    this.lastTagTime = now;

    this.playAudioFeedback("read");
    this.triggerHaptic([100]);

    const detail: RfidEventDetail = {
      tag: cleanTag,
      timestamp: now,
      source: "ble",
    };

    // Dispara evento global no window para qualquer ouvinte do app
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cattlevision:rfid-read", { detail }));
    }

    // Notifica listeners registrados
    this.tagListeners.forEach((listener) => {
      try {
        listener(detail);
      } catch (err) {
        console.error("[BluetoothRfid] Erro no listener:", err);
      }
    });
  }

  /**
   * Emite manualmente uma leitura de tag (usado pelo Simulador / Leitura Manual para testes
   * ou em dispositivos sem Web Bluetooth como iPhone Safari).
   */
  public emitManualTag(tag: string, source: "manual" | "simulation" = "manual") {
    const cleanTag = tag.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().trim();
    if (!cleanTag) return;

    const now = Date.now();
    this.lastTag = cleanTag;
    this.lastTagTime = now;

    this.playAudioFeedback("read");
    this.triggerHaptic([80]);

    const detail: RfidEventDetail = {
      tag: cleanTag,
      timestamp: now,
      source,
    };

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cattlevision:rfid-read", { detail }));
    }

    this.tagListeners.forEach((listener) => {
      try {
        listener(detail);
      } catch (err) {
        console.error("[BluetoothRfid] Erro no listener manual:", err);
      }
    });
  }
}

// Instância singleton global do serviço
export const bluetoothRfid = new BluetoothRfidService();
