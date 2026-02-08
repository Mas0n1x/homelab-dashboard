export default {
  async email(message, env, ctx) {
    try {
      // Read raw email as ArrayBuffer, convert to base64
      const rawBytes = await new Response(message.raw).arrayBuffer();
      const uint8 = new Uint8Array(rawBytes);
      let binary = '';
      for (let i = 0; i < uint8.length; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      const base64Email = btoa(binary);

      // Forward to backend webhook
      const response = await fetch(env.WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': env.WEBHOOK_SECRET,
        },
        body: JSON.stringify({
          from: message.from,
          to: [message.to],
          subject: message.headers.get('subject') || '(kein Betreff)',
          rawEmail: base64Email,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.log(`Webhook error: ${response.status} ${text}`);
        message.setReject(`Backend error: ${response.status}`);
      } else {
        console.log(`Mail forwarded: ${message.from} -> ${message.to}`);
      }
    } catch (error) {
      console.log(`Worker error: ${error.message}`);
      message.setReject('Internal error');
    }
  },
};
