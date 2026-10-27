import webpush from 'web-push';

export type Recipient = { userId?: string; email?: string };
export type NotificationInput = { title: string; body: string; url?: string };

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const pushEnabled = Boolean(vapidPublicKey && vapidPrivateKey);
if (pushEnabled) webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@unishop.local', vapidPublicKey, vapidPrivateKey);

export const getVapidPublicKey = () => (pushEnabled ? vapidPublicKey : null);
export const adminEmail = () => process.env.ADMIN_EMAIL || '';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string));

// Email goes through the Resend HTTP API so no SMTP server or extra dependency is needed.
export async function sendEmail(to: string, input: NotificationInput) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !to) return false;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'Unishop <onboarding@resend.dev>',
      to: [to],
      subject: input.title,
      html: `<p>${escapeHtml(input.body)}</p>`,
      text: input.body
    })
  });
  if (!response.ok) throw new Error(`Email provider responded ${response.status}`);
  return true;
}

// Returns true when delivered, 'gone' when the subscription is expired and should be dropped.
export async function sendPush(subscription: any, input: NotificationInput): Promise<boolean | 'gone'> {
  if (!pushEnabled) return false;
  try {
    await webpush.sendNotification(subscription, JSON.stringify(input));
    return true;
  } catch (error: any) {
    if (error?.statusCode === 404 || error?.statusCode === 410) return 'gone';
    throw error;
  }
}

// Phone notification for the admin through ntfy (install the ntfy app and subscribe to the topic).
export async function sendAdminPhone(input: NotificationInput) {
  const topic = process.env.ADMIN_NTFY_TOPIC;
  if (!topic) return false;
  const server = (process.env.NTFY_SERVER || 'https://ntfy.sh').replace(/\/$/, '');
  const headers: Record<string, string> = { Title: input.title.replace(/[^\x20-\x7E]/g, '') };
  if (process.env.NTFY_TOKEN) headers.Authorization = `Bearer ${process.env.NTFY_TOKEN}`;
  const response = await fetch(`${server}/${encodeURIComponent(topic)}`, { method: 'POST', headers, body: input.body });
  if (!response.ok) throw new Error(`ntfy responded ${response.status}`);
  return true;
}
