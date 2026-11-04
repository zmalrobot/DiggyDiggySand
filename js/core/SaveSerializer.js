// Serializzatore e validatore per Esportazione e Importazione del Salvataggio di Gioco (Base64).
// Protegge l'integrità dei dati, supporta caratteri Unicode e convalida lo schema prima del ripristino.
import { SAVE_KEY, SAVE_BACKUP_KEY, validateSave } from './Save.js';
import { events } from './Events.js';

/** Codifica una stringa UTF-8 in Base64 cross-browser e sicura per Unicode. */
export function utf8ToBase64(str) {
  if (typeof btoa === 'function') {
    try {
      return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
        String.fromCharCode(parseInt(p1, 16))
      ));
    } catch {
      return btoa(str);
    }
  }
  return Buffer.from(str, 'utf-8').toString('base64');
}

/** Decodifica una stringa Base64 in UTF-8 cross-browser e sicura per Unicode. */
export function base64ToUtf8(str) {
  const clean = str.trim();
  if (typeof atob === 'function') {
    try {
      return decodeURIComponent(Array.prototype.map.call(atob(clean), (c) =>
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      ).join(''));
    } catch {
      return atob(clean);
    }
  }
  return Buffer.from(clean, 'base64').toString('utf-8');
}

export class SaveSerializer {
  /**
   * Converte un oggetto di salvataggio in una stringa compatta Base64.
   * @param {Object} saveData
   * @returns {string} Stringa Base64 con prefisso DDS1_
   */
  static serialize(saveData) {
    if (!saveData || typeof saveData !== 'object') {
      throw new Error('Dati di salvataggio non validi per la serializzazione');
    }
    const json = JSON.stringify(saveData);
    const b64 = utf8ToBase64(json);
    return `DDS1_${b64}`;
  }

  /**
   * Decodifica e convalida una stringa Base64, restituendo l'oggetto di salvataggio.
   * Lancia un errore esplicito se la stringa è corrotta o non supera la validazione dello schema.
   * @param {string} rawString
   * @returns {Object} Oggetto saveData validato
   */
  static deserialize(rawString) {
    if (!rawString || typeof rawString !== 'string') {
      throw new Error('Stringa di salvataggio non valida o vuota');
    }
    let b64 = rawString.trim();
    if (b64.startsWith('DDS1_')) {
      b64 = b64.slice(5);
    }

    let json = '';
    try {
      json = base64ToUtf8(b64);
    } catch (e) {
      throw new Error('Formato Base64 corrotto o non riconosciuto');
    }

    let data = null;
    try {
      data = JSON.parse(json);
    } catch (e) {
      throw new Error('JSON decodificato non valido');
    }

    if (!validateSave(data)) {
      throw new Error('I dati di salvataggio non rispettano i vincoli di integrità e schema');
    }

    return data;
  }

  /**
   * Esporta il salvataggio corrente dallo storage copiandolo negli appunti.
   * Se non ancora persistito, interroga lo stato di gioco live.
   * @param {Storage|Object} [storageOrData]
   * @returns {Promise<{ ok: boolean, code?: string, error?: string }>}
   */
  static async exportToClipboard(storageOrData = null) {
    let data = null;
    if (storageOrData && typeof storageOrData === 'object' && ('sand' in storageOrData || 'seed' in storageOrData)) {
      data = storageOrData;
    } else {
      const s = (storageOrData && typeof storageOrData.getItem === 'function')
        ? storageOrData
        : (typeof window !== 'undefined' ? window.localStorage : null);

      let raw = s?.getItem?.(SAVE_KEY);
      if (!raw) {
        // Fallback: se in sessione di gioco attiva, serializza al volo
        if (typeof window !== 'undefined' && window.__dds?.game?.serialize) {
          data = window.__dds.game.serialize();
          if (s) {
            try { s.setItem(SAVE_KEY, JSON.stringify(data)); } catch {}
          }
        } else {
          return { ok: false, error: 'Nessun salvataggio trovato da esportare' };
        }
      } else {
        try {
          data = JSON.parse(raw);
        } catch {
          return { ok: false, error: 'Salvataggio corrente corrotto' };
        }
      }
    }

    try {
      const code = SaveSerializer.serialize(data);
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(code);
        } catch {}
      }
      return { ok: true, code };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /**
   * Importa una stringa Base64 e la persiste in modo sicuro su localStorage.
   * @param {string} code
   * @param {Storage|Object} storage
   * @returns {{ ok: boolean, data?: Object, error?: string }}
   */
  static importFromCode(code, storage = null) {
    try {
      const data = SaveSerializer.deserialize(code);
      const s = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
      if (!s) return { ok: false, error: 'Storage non accessibile' };

      // Crea prima un backup preventivo del salvataggio precedente se esistente
      const prev = s.getItem(SAVE_KEY);
      if (prev) {
        s.setItem(SAVE_BACKUP_KEY, prev);
      }

      s.setItem(SAVE_KEY, JSON.stringify(data));
      events.emit('save:imported', { data });
      return { ok: true, data };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
}
