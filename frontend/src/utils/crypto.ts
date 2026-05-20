export const generateKeyPair = async () => {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  const publicKeyJwk = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateKeyJwk = await window.crypto.subtle.exportKey("jwk", keyPair.privateKey);

  // Store private key securely (e.g., indexedDB or memory, for now localStorage for simplicity)
  localStorage.setItem('privateKey', JSON.stringify(privateKeyJwk));
  
  return publicKeyJwk;
};

const deriveSharedKey = async (idA: string, idB: string) => {
  const encoder = new TextEncoder();
  const orderedIds = [idA, idB].sort().join(':');
  const rawKey = await window.crypto.subtle.digest('SHA-256', encoder.encode(orderedIds));
  return window.crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
};

export const encryptMessage = async (
  message: string,
  selfId: string,
  recipientId: string
): Promise<{ encrypted: string; iv: string }> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await deriveSharedKey(selfId, recipientId);

  const encryptedBuf = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    cryptoKey,
    data
  );

  const encryptedArray = new Uint8Array(encryptedBuf);
  const encryptedBase64 = btoa(String.fromCharCode(...encryptedArray));
  const ivBase64 = btoa(String.fromCharCode(...iv));

  return {
    encrypted: encryptedBase64,
    iv: ivBase64,
  };
};

export const decryptMessage = async (
  encryptedBase64: string,
  ivBase64: string,
  selfId: string,
  otherId: string
): Promise<string> => {
  const decoder = new TextDecoder();
  const cryptoKey = await deriveSharedKey(selfId, otherId);

  const encryptedString = atob(encryptedBase64);
  const encryptedArray = new Uint8Array(encryptedString.length);
  for (let i = 0; i < encryptedString.length; i++) {
    encryptedArray[i] = encryptedString.charCodeAt(i);
  }

  const ivString = atob(ivBase64);
  const ivArray = new Uint8Array(ivString.length);
  for (let i = 0; i < ivString.length; i++) {
    ivArray[i] = ivString.charCodeAt(i);
  }

  try {
    const decryptedBuf = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: ivArray,
      },
      cryptoKey,
      encryptedArray
    );

    return decoder.decode(decryptedBuf);
  } catch (error) {
    console.error("Decryption failed", error);
    return "[Encrypted Message - Unable to Decrypt]";
  }
};
