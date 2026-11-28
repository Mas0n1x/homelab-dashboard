/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Deckt die Aufrufe ab, die gmail.js beim Senden macht (Schutz bei nodemailer-Updates).
import test from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import { simpleParser } from 'mailparser';

test('Mail mit Namen, Anhang und Antwortbezug wird richtig gebaut', async () => {
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
  const { message } = await transport.sendMail({
    from: { name: 'Max Test', address: 'a@example.com' }, to: [{ name: 'Ü Empfänger', address: 'b@example.com' }],
    subject: 'Grüße', text: 'Hallo', inReplyTo: '<x@example.com>',
    attachments: [{ filename: 'ä.txt', content: Buffer.from('inhalt'), contentType: 'text/plain' }],
  });
  const m = await simpleParser(message);
  assert.equal(m.from.value[0].address, 'a@example.com');
  assert.equal(m.to.value[0].name, 'Ü Empfänger');
  assert.equal(m.subject, 'Grüße');
  assert.equal(m.inReplyTo, '<x@example.com>');
  assert.equal(m.attachments[0].filename, 'ä.txt');
});
