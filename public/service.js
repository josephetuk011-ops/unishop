const root = document.querySelector('#pp-root');
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const img = (id, width = 900) => !id ? '' : id.startsWith('/') || /^https:\/\/res\.cloudinary\.com\//.test(id) ? id : `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80`;
const serviceId = new URLSearchParams(location.search).get('id') || '';
let service;

function toast(message) {
  const node = document.querySelector('#pp-toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('show'), 3200);
}
function showSlide(index, slides) {
  const stage = document.querySelector('#pp-stage');
  stage.querySelector('video')?.pause();
  const slide = slides[index];
  stage.innerHTML = slide.type === 'video'
    ? `<video src="${esc(img(slide.src))}" controls playsinline autoplay muted aria-label="Video of ${esc(service.title)}"></video>`
    : `<img src="${esc(img(slide.src, 1200))}" alt="${esc(service.title)}">`;
}
async function negotiate() {
  const token = localStorage.getItem('unishop-token');
  const user = JSON.parse(localStorage.getItem('unishop-user') || '{}');
  if (!token || user.role !== 'customer') {
    toast('Sign in with a customer account to negotiate with this service provider.');
    setTimeout(() => location.assign('/?signin=1'), 1600);
    return;
  }
  try {
    const result = await window.UnishopChat.call('/api/chats', { method: 'POST', body: JSON.stringify({ listingId: service.id }) });
    window.UnishopChat.openModal(result.conversation.id);
  } catch (error) { toast(error.message); }
}
function render() {
  document.title = `${service.title} | Unishop`;
  const photos = (Array.isArray(service.portfolio) && service.portfolio.length ? service.portfolio : [service.image]).filter(Boolean);
  const slides = photos.map((photo) => ({ type: 'image', src: photo }));
  if (service.video) slides.push({ type: 'video', src: service.video });
  const profile = service.providerProfile || {};
  const ratingLine = service.reviewCount ? `<strong>★ ${Number(service.rating).toFixed(1)}/5</strong> · ${service.reviewCount} customer ratings` : 'New service · No ratings yet';
  const team = Array.isArray(profile.teamImages) ? profile.teamImages : [];
  const button = '<button class="button button-dark pp-negotiate" type="button">Proceed to negotiation</button>';
  root.innerHTML = `
    <div class="pp-top">
      <div class="pp-gallery">
        <div class="pp-stage" id="pp-stage"></div>
        ${slides.length > 1 ? `<div class="pp-thumbs">${slides.map((slide, index) => `<button class="pp-thumb${index === 0 ? ' active' : ''}" data-slide="${index}" aria-label="Show ${slide.type} ${index + 1}"><img src="${esc(img(slide.type === 'video' ? photos[0] : slide.src, 160))}" alt=""></button>`).join('')}</div>` : ''}
      </div>
      <div class="pp-info">
        <p class="eyebrow">${esc(service.niche || 'Local service')} · UYO MARKETPLACE</p>
        <h1>${esc(service.title)}</h1>
        <div class="pp-rating">${ratingLine}${service.online ? ' · <span class="online-dot">Online now</span>' : ''}</div>
        <div class="pp-price sv-negotiable">Price agreed in chat</div>
        <div class="pp-actions pp-inline">${button}</div>
        ${service.userId ? `<a class="pp-vendor sv-ceo" href="/vendor.html?id=${encodeURIComponent(service.userId)}">${profile.ceoImage ? `<img src="${esc(img(profile.ceoImage, 200))}" alt="${esc(profile.name || 'Owner')}">` : '<i></i>'}<div><strong>${esc(profile.name || service.provider)}</strong><span>${esc(profile.position || 'Owner')} · ${esc(profile.businessName || service.provider)}</span><small>${esc(profile.placeOfOperation || service.neighbourhood || 'Uyo, Akwa Ibom')}</small></div></a>` : ''}
      </div>
    </div>
    <section class="pp-section"><h2>About this service</h2><p class="pp-desc">${esc(service.description || '')}</p></section>
    ${profile.aboutMe ? `<section class="pp-section"><h2>About ${esc(profile.businessName || service.provider)}</h2><p class="pp-desc">${esc(profile.aboutMe)}</p>${team.length ? `<div class="sv-team">${team.map((photo) => `<img src="${esc(img(photo, 300))}" alt="Team member" loading="lazy">`).join('')}</div>` : ''}</section>` : ''}
    ${(service.reviews || []).length ? `<section class="pp-section"><h2>Customer ratings</h2>${service.reviews.slice(0, 8).map((review) => `<p class="pp-desc"><strong>${'★'.repeat(Math.round(review.rating))}</strong> ${esc(review.comment || '')}</p>`).join('')}</section>` : ''}
    <div class="pp-sticky"><div class="pp-actions" style="margin:0;flex:1">${button}</div></div>`;
  showSlide(0, slides);
  root.querySelectorAll('.pp-thumb').forEach((thumb) => thumb.addEventListener('click', () => {
    root.querySelectorAll('.pp-thumb').forEach((item) => item.classList.toggle('active', item === thumb));
    showSlide(Number(thumb.dataset.slide), slides);
  }));
  root.querySelectorAll('.pp-negotiate').forEach((node) => node.addEventListener('click', negotiate));
}

fetch('/api/services').then((response) => response.ok ? response.json() : []).then((data) => {
  service = (Array.isArray(data) ? data : []).find((item) => item.id === serviceId);
  if (!service) throw new Error('This service was not found.');
  render();
}).catch((error) => { root.innerHTML = `<p class="pp-empty">${esc(error.message)} <a href="/#services">Back to services</a></p>`; });
