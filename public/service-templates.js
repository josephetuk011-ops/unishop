// Suggested listing text for service providers. They fill in the [brackets] and delete what does not apply.
// Prices are a guide: the final price is still agreed with the customer in chat.
(function () {
  const laundry = {
    label: 'Laundry',
    title: '[Your business name] laundry, wash and iron',
    text: `ABOUT US
We wash, dry, iron and fold your clothes with care. We handle Ankara, Senator, jeans, T-shirts, bedsheets, duvets and school uniforms. We wash white clothes separately from coloured clothes. We do not wash leather.

HOW WE WORK
1. Book: choose pickup or drop-off and select your date.
2. Confirm: we count your clothes together with you and confirm the total price before washing.
3. Wash and iron: we wash, dry and iron your clothes.
4. Ready: we call you when ready. You pick up or we deliver to you.

PRICES (final price agreed in chat)
- Per cloth (shirt, trouser, dress): ₦[500]
- Bedsheet: ₦[1,500]
- Duvet: ₦[3,000]
- School uniform set: ₦[800]
- Express service (same day): extra ₦[1,000]

DETAILS
- Turnaround: normal [48 hours], express [same day]
- Working hours: [Mon - Sat, 8 AM - 7 PM]
- Pickup area: [your areas]
- Minimum order: ₦[2,000]
- Progress you will see: Received, Counting, Washing, Drying, Ironing, Ready for pickup, Delivered

IF WE DAMAGE OR LOSE A CLOTH
We pay you [2x the washing price] or replace it. Report within 24 hours of pickup.`
  };
  const templates = {
    'Laundry and ironing': laundry,
    'Dry cleaning': laundry,
    'Photographer': {
      label: 'Photography',
      title: '[Studio or photographer name], portraits and events',
      text: `ABOUT ME
I am a portrait and event photographer based in [your area]. I cover birthdays, weddings, church programs, graduations and studio shoots. You receive edited soft copies with no watermark.

HOW WE WORK
1. Book: choose studio, outdoor or event and pick your date.
2. Confirm: we confirm time and location on WhatsApp within 1 hour.
3. Shoot: we shoot on the agreed day and time.
4. Delivery: you receive edited photos in [2-3 days] by download link.

PRICES (final price agreed in chat)
- Studio portrait: ₦[15,000] for [10 edited photos]
- Birthday coverage: ₦[50,000] for [3 hours]
- Wedding coverage: from ₦[120,000]
- Graduation shoot: ₦[25,000]

INCLUDED
Edited photos, soft copies with no watermark, [1 free printed photo for studio].

NOT INCLUDED
Extra prints, video, transport outside [your area] (extra ₦[5,000]).

BOOKING RULE
Pay a [50%] deposit to lock your date. Balance after the shoot. If you cancel less than 24 hours before, the deposit is not refundable.`
    },
    'Graphic design': {
      label: 'Graphic design',
      title: '[Designer name], logos, flyers and posters',
      text: `ABOUT ME
I design logos, birthday flyers, business flyers, church posters and social media designs. My designs are clean and ready for WhatsApp, Instagram and printing.

HOW WE WORK
1. Order: tell me what you want and upload your photo or text.
2. Sample: I send the first sample in [24 hours].
3. Correction: you ask for changes (colour, name, photo).
4. Final: I send the final design in JPG and PDF.

PRICES (final price agreed in chat)
- Flyer / birthday design: ₦[5,000]
- Logo: ₦[15,000]
- Business card: ₦[7,000]
- Church poster: ₦[5,000]

DETAILS
- Delivery: flyer [24 hours], logo [2 days]
- Free corrections: [2]. Extra correction: ₦[1,000]
- Working hours: [Daily, 9 AM - 9 PM]
- Reply time: within [1 hour]

YOU MUST PROVIDE
Business name, the text for the design, your photo (if needed), the colours you like.

REFUND RULE
If I do not deliver a sample within [48 hours], you get a full refund.`
    },
    'Barbing': {
      label: 'Barbing',
      title: '[Barber or shop name], clean cuts and fades',
      text: `ABOUT ME
I cut at my shop in [your area] and I also do home service. I do low cut, fade, dread maintenance, kids cut and dye. I use clean, sterilized clippers for every customer.

HOW WE WORK
1. Book: choose your style and book a time slot.
2. Arrive: come to the shop or we come to you for home service.
3. Cut: we cut, you check in the mirror.
4. Pay: you pay and rate us.

PRICES (final price agreed in chat)
- Low cut: ₦[2,000]
- Fade: ₦[3,000]
- Dread retouch: ₦[5,000]
- Kids cut (under 10): ₦[1,500]
- Dye / colour: ₦[4,000]
- Home service: extra ₦[2,000]

DETAILS
- Time per cut: [30 minutes]
- Working hours: [Mon - Sat, 9 AM - 8 PM, closed Sunday]
- Home service area: [your areas]

HYGIENE PROMISE
New blade for every customer. Clippers cleaned after every cut.

LATE RULE
If you do not come within 15 minutes of your booked time, your slot goes to the next person.`
    },
    'Hair dressing': {
      label: 'Hair making and braiding',
      title: '[Stylist name], braids, wigs and silk press',
      text: `ABOUT ME
I make knotless braids, stitch braids, wig installs, silk press and natural hair treatment. I work in my shop and also do home service. I am gentle with edges and I do not pull hair too tight.

HOW WE WORK
1. Book: choose a style from my photos and book a date.
2. Deposit: pay ₦[2,000] to hold your slot.
3. Prepare: bring your attachments or choose "provide attachment for me".
4. Style: we make your hair, you check it, you pay the balance.

PRICES (final price agreed in chat)
- Knotless braids: ₦[15,000] without attachment
- Stitch braids: ₦[10,000] without attachment
- Wig install: ₦[8,000]
- Silk press: ₦[12,000]
- Provide attachment for me: extra ₦[8,000]

DETAILS
- Time needed: knotless [4 hours], stitch braids [2 hours], wig install [1 hour]
- Book [1 day] ahead. No same-day walk-in for braids.
- Working hours: [Mon - Sat, 9 AM - 6 PM]
- Home service: [yes / no], extra ₦[3,000]

BRING
Your attachments (if I am not providing them) and your preferred hair cream or edge control.

CANCELLATION
If you cancel less than 3 hours before, the deposit is lost. If I cancel, I refund your deposit double.`
    }
  };
  window.UnishopServiceTemplates = {
    get: (niche) => templates[niche] || null,
    hasPlaceholders: (text) => /\[[^\]\n]{1,80}\]/.test(String(text || ''))
  };
})();
