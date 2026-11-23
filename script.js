const CATEGORIES = ["ALL", "DRESSES", "OUTERWEAR", "BLOUSES", "SETS"];
// 회원과 주문 정보는 Supabase에서 관리하고, 장바구니만 브라우저에 보관합니다.
const STORAGE = { cart: "pride_cart" };
const money = value => new Intl.NumberFormat("ko-KR").format(value) + "원";
const read = (key, fallback) => { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
let cart = read(STORAGE.cart, []);
let session = null, profile = null, authInitialization = null;
// 장바구니에는 shop_products의 id만 상품 식별자로 저장합니다.
cart = cart.map(item => ({ productId: item.productId ?? item.id, qty: item.qty || 1 }));
let productCache = new Map();
let productRequestId = 0;
let activeCategory = "ALL", searchKeyword = "", slideIndex = 0, slideTimer = null, toastTimer = null, detailQty = 1, mypageTab = "orders";
const app = document.getElementById("app");
const $ = selector => document.querySelector(selector);
const currentUser = () => profile;
const displayGrade = grade => ({ WELCOME: "WELCOME", SILVER: "SILVER", GOLD: "GOLD", VIP: "VIP" }[grade] || grade || "WELCOME");
const FALLBACK_IMAGE = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000"><rect width="800" height="1000" fill="#f2f0eb"/><path d="M250 650h300l-35-260H285z" fill="#ded9ce"/><circle cx="400" cy="290" r="95" fill="#ded9ce"/><text x="400" y="790" text-anchor="middle" font-family="Arial,sans-serif" font-size="34" fill="#8b8376">PRIDE</text></svg>');
const imageSrc = value => value && String(value).trim() ? safe(value) : FALLBACK_IMAGE;
const safe = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
function persist() { write(STORAGE.cart, cart); }
let isCheckingOut = false;

function authErrorMessage(error) {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("already registered")) return "이미 가입된 이메일입니다.";
  if (message.includes("invalid login credentials")) return "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (message.includes("email not confirmed")) return "이메일 인증을 먼저 완료해 주세요.";
  if (message.includes("password") && (message.includes("length") || message.includes("short"))) return "비밀번호는 6자 이상 입력해 주세요.";
  if (message.includes("rate limit")) return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
  return "요청을 처리하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.";
}

async function loadProfile() {
  if (!session?.user) { profile = null; updateHeader(); return null; }
  const { data, error } = await db.from("shop_profiles")
    .select("id, email, name, phone, grade, points, role, created_at")
    .eq("id", session.user.id).single();
  if (error) {
    profile = null;
    console.error("회원 정보 조회 오류:", error.message);
    updateHeader();
    return null;
  }
  profile = data;
  updateHeader();
  return profile;
}

async function refreshAuthSession() {
  const { data, error } = await db.auth.getSession();
  if (error) console.error("로그인 상태 확인 오류:", error.message);
  session = data?.session || null;
  await loadProfile();
  return session;
}

db.auth.onAuthStateChange((event, newSession) => {
  session = newSession;
  // 인증 콜백 안에서 Supabase 요청을 기다리지 않도록 다음 작업으로 넘깁니다.
  Promise.resolve().then(async () => {
    await loadProfile();
    if (event === "SIGNED_OUT") navigate("home");
  });
});

function toast(message) { const el = $("#toast"); el.textContent = message; el.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2300); }
function updateHeader() {
  const user = currentUser();
  $("#accountLinks").innerHTML = user
    ? `<span>${safe(user.name)} 님</span> <span>·</span> <button data-action="logout">로그아웃</button>`
    : `<button data-view="login">로그인</button><span>·</span><button data-view="signup">회원가입</button>`;
  $("#cartCount").textContent = cart.reduce((sum, item) => sum + item.qty, 0);
}
function startSlides() {
  const slides = [
    { image:"img/banner/banner1.jpg", eyebrow:"THE NEW CLASSIC", title:"PRIDE", text:"당신의 오늘을 더 우아하게" },
    { image:"img/banner/banner2.jpg", eyebrow:"TIMELESS ELEGANCE", title:"A QUIET LUXURY", text:"시간이 지나도 변하지 않는 아름다움" },
    { image:"img/banner/banner3.jpg", eyebrow:"MADE FOR YOUR MOMENTS", title:"OWN YOUR STYLE", text:"당신만의 분위기를 완성하는 선택" },
    { image:"img/banner/banner4.jpg", eyebrow:"THE PRIDE EDIT", title:"ELEGANCE, EVERYDAY", text:"일상에 자연스럽게 스며드는 우아함" }
  ];
  $("#heroSlides").innerHTML = slides.map((slide, i) => `<article class="hero-slide ${i===0?"active":""}" style="background-image:url('${slide.image}')"><div class="hero-copy"><span class="eyebrow">${slide.eyebrow}</span><h1>${slide.title}</h1><p>${slide.text}</p><button data-view="products">SHOP THE COLLECTION　→</button></div></article>`).join("");
  $("#slideDots").innerHTML = slides.map((_, i) => `<button class="${i===0?"active":""}" data-slide="${i}" aria-label="${i+1}번 배너"></button>`).join("");
  clearInterval(slideTimer); slideTimer = setInterval(() => showSlide((slideIndex + 1) % slides.length), 6000);
}
function showSlide(index) { const slides = [...document.querySelectorAll(".hero-slide")]; if (!slides.length) return; slideIndex = (index + slides.length) % slides.length; slides.forEach((slide, i) => slide.classList.toggle("active", i === slideIndex)); document.querySelectorAll("[data-slide]").forEach((dot, i) => dot.classList.toggle("active", i === slideIndex)); }
function productCard(product) {
  const soldOut = Number(product.stock) <= 0;
  return `<article class="product-card" data-product="${safe(product.id)}" tabindex="0" aria-label="${safe(product.name)} 상세 보기">
    <div class="product-image"><img src="${imageSrc(product.image_url)}" alt="${safe(product.name)}" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}'">
    ${soldOut ? `<span class="product-tag">품절</span>` : ""}</div>
    <div class="product-info"><span class="product-category">${safe(product.category)}</span>
    <div class="product-name">${safe(product.name)}</div><div class="product-price">${money(product.price)}</div>
    <div class="product-desc">${soldOut ? "품절" : "PRIDE PREMIUM COLLECTION"}</div></div></article>`;
}
async function fetchProducts({ category = "ALL", keyword = "", limit = null } = {}) {
  let query = db.from("shop_products").select("id, name, category, price, stock, image_url, is_active, created_at")
    .eq("is_active", true).order("id", { ascending: true });
  if (category !== "ALL") query = query.eq("category", category);
  if (keyword) query = query.ilike("name", `%${keyword}%`);
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw error;
  (data || []).forEach(product => productCache.set(String(product.id), product));
  return data || [];
}
function renderHome() {
  app.innerHTML = `<section class="hero" id="hero" aria-label="PRIDE 메인 배너"><div class="hero-slides" id="heroSlides"></div><button class="slide-arrow prev" id="prevSlide" data-action="slide-prev" aria-label="이전 배너">‹</button><button class="slide-arrow next" id="nextSlide" data-action="slide-next" aria-label="다음 배너">›</button><div class="slide-dots" id="slideDots"></div></section><section class="benefits wrap"><div><span class="benefit-icon">◇</span><p><b>FREE SHIPPING</b><small>5만원 이상 무료배송</small></p></div><div><span class="benefit-icon">♧</span><p><b>WELCOME POINT</b><small>신규 가입 시 3,000P</small></p></div><div><span class="benefit-icon">♕</span><p><b>MEMBERSHIP</b><small>등급별 최대 7% 적립</small></p></div><div><span class="benefit-icon">♡</span><p><b>PRIDE SERVICE</b><small>언제나 세심한 스타일링</small></p></div></section><section class="category-section wrap"><div class="section-heading"><span>CURATED FOR YOU</span><h2>SHOP BY CATEGORY</h2><p>일상에 우아함을 더하는 PRIDE의 셀렉션</p></div><div class="category-grid" id="categoryGrid"></div></section><section class="products-section wrap"><div class="section-heading"><span>THE PRIDE EDIT</span><h2>BEST COLLECTION</h2><p>지금 가장 사랑받는 아이템을 만나보세요.</p></div><div class="product-grid" id="homeProducts"><div class="empty-state">불러오는 중</div></div><button class="outline-button center-button" data-view="products">전체 상품 보기 <span>→</span></button></section><section class="brand-banner wrap"><div><span>THE ART OF EVERYDAY</span><h2>Elegance is an attitude.</h2><p>당신만의 분위기를 완성하는 가장 아름다운 선택.</p><button class="gold-button" data-view="products">PRIDE COLLECTION <span>→</span></button></div></section>`;
  startSlides();
  const categoryImages = { "DRESSES":"img/products/dress1.jpg", "OUTERWEAR":"img/products/outer1.jpg", "BLOUSES":"img/products/blouse1.jpg", "SETS":"img/products/etc1.jpg" };
  $("#categoryGrid").innerHTML = CATEGORIES.slice(1).map(category => `<article class="category-card" data-category="${category}"><img src="${categoryImages[category] || FALLBACK_IMAGE}" alt="${category}" loading="lazy"><div><b>${category}</b><span>DISCOVER　→</span></div></article>`).join("");
  fetchProducts({ limit: 4 }).then(list => {
    const target = $("#homeProducts");
    if (!target) return;
    target.innerHTML = list.length ? list.map(productCard).join("") : `<div class="empty-state">상품이 없습니다</div>`;
  }).catch(error => {
    console.error("메인 상품 조회 오류:", error.message);
    const target = $("#homeProducts");
    if (target) target.innerHTML = `<div class="empty-state">상품을 불러오지 못했습니다.</div>`;
  });
}
function renderProducts() {
  app.innerHTML = `<section class="page-shell"><div class="page-title"><span>PRIDE COLLECTION</span><h1>SHOP ALL</h1><p>당신의 스타일을 완성할 아이템</p></div><div class="toolbar"><div class="filter-row">${CATEGORIES.map(c=>`<button class="filter-chip ${activeCategory===c?"active":""}" data-filter="${c}">${c}</button>`).join("")}</div><div class="search-box"><input id="productSearch" type="search" placeholder="상품명을 검색하세요" value="${safe(searchKeyword)}" aria-label="상품 검색"><button data-action="search">⌕</button></div></div><div class="toolbar"><span id="resultCount" class="product-desc"></span><select class="sort-select" id="sortProducts" aria-label="상품 정렬"><option value="default">추천순</option><option value="low">낮은 가격순</option><option value="high">높은 가격순</option><option value="name">상품명순</option></select></div><div class="product-grid" id="allProducts"><div class="empty-state" style="grid-column:1/-1">불러오는 중</div></div></section>`;
  drawProductList();
}
async function drawProductList() {
  const target = $("#allProducts");
  if (!target) return;
  const requestId = ++productRequestId;
  target.innerHTML = `<div class="empty-state" style="grid-column:1/-1">불러오는 중</div>`;
  $("#resultCount").textContent = "";
  try {
    const list = await fetchProducts({ category: activeCategory, keyword: searchKeyword });
    if (requestId !== productRequestId || !$("#allProducts")) return;
    const sort = $("#sortProducts")?.value;
    if (sort === "low") list.sort((a,b)=>Number(a.price)-Number(b.price));
    if (sort === "high") list.sort((a,b)=>Number(b.price)-Number(a.price));
    if (sort === "name") list.sort((a,b)=>String(a.name).localeCompare(String(b.name),"ko"));
    $("#resultCount").textContent = `TOTAL ${list.length} ITEMS`;
    target.innerHTML = list.length ? list.map(productCard).join("") : `<div class="empty-state" style="grid-column:1/-1"><b>상품이 없습니다</b></div>`;
  } catch (error) {
    if (requestId !== productRequestId) return;
    console.error("상품 목록 조회 오류:", error.message);
    target.innerHTML = `<div class="empty-state" style="grid-column:1/-1">상품을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>`;
  }
}
async function renderDetail(id) {
  detailQty = 1;
  app.innerHTML = `<section class="page-shell"><div class="page-title"><span>PRIDE COLLECTION</span><h1>PRODUCT DETAIL</h1></div><div class="empty-state">불러오는 중</div></section>`;
  try {
    const { data: p, error } = await db.from("shop_products")
      .select("id, name, category, price, stock, image_url, is_active, created_at")
      .eq("id", id).eq("is_active", true).single();
    if (error || !p) throw error || new Error("상품을 찾을 수 없습니다.");
    productCache.set(String(p.id), p);
    const soldOut = Number(p.stock) <= 0;
    app.innerHTML = `<section class="page-shell"><div class="page-title"><span>PRIDE COLLECTION</span><h1>PRODUCT DETAIL</h1></div><div class="detail-layout"><div class="detail-image"><img src="${imageSrc(p.image_url)}" alt="${safe(p.name)}" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}'"></div><div class="detail-copy"><span class="product-category">${safe(p.category)}</span><h1>${safe(p.name)}</h1><div class="detail-price">${money(p.price)}</div><div class="detail-description">PRIDE의 감각적인 디자인과 섬세한 디테일로 완성한 아이템입니다.</div><div class="detail-row"><span>배송</span><span>5만원 이상 무료배송</span></div><div class="detail-row"><span>재고</span><span id="detailStock">${Number(p.stock)}개</span></div>${soldOut ? `<div class="notice">품절된 상품입니다.</div>` : `<div class="qty-control"><button data-action="detail-minus">−</button><span id="detailQty">1</span><button data-action="detail-plus">＋</button></div>`}<div class="action-row"><button class="secondary-button" data-action="add-cart" data-id="${safe(p.id)}" ${soldOut?"disabled":""}>장바구니 담기</button><button class="primary-button" data-action="buy-now" data-id="${safe(p.id)}" ${soldOut?"disabled":""}>바로 구매</button></div></div></div></section>`;
  } catch (error) {
    console.error("상품 상세 조회 오류:", error.message);
    app.innerHTML = `<section class="page-shell"><div class="empty-state"><b>상품이 없습니다</b><br><button class="outline-button" data-view="products">상품 목록으로</button></div></section>`;
  }
}

async function renderCart() {
  const ids = [...new Set(cart.map(item => item.productId).filter(id => id !== undefined && id !== null))];
  let products = [];
  if (ids.length) {
    const { data, error } = await db.from("shop_products")
      .select("id, name, category, price, stock, image_url, is_active, created_at")
      .in("id", ids);
    if (error) console.error("장바구니 상품 조회 오류:", error.message);
    products = data || [];
    products.forEach(product => productCache.set(String(product.id), product));
  }
  const productById = new Map(products.map(product => [String(product.id), product]));
  const items = cart.map(item => ({ ...item, product: productById.get(String(item.productId)) })).filter(item => item.product);
  const subtotal = items.reduce((sum,item)=>sum+Number(item.product.price)*item.qty,0);
  app.innerHTML = `<section class="page-shell"><div class="page-title"><span>YOUR SELECTION</span><h1>SHOPPING BAG</h1></div>${items.length?`<table class="cart-table"><thead><tr><th>상품 정보</th><th>가격</th><th>수량</th><th>합계</th><th></th></tr></thead><tbody>${items.map(item=>`<tr><td><div class="cart-product"><img src="${imageSrc(item.product.image_url)}" alt="" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}'"><div><b>${safe(item.product.name)}</b><small>${safe(item.product.category)}${Number(item.product.stock)<=0?" · 품절":""}</small></div></div></td><td>${money(item.product.price)}</td><td><div class="cart-qty"><button data-action="cart-minus" data-id="${safe(item.productId)}">−</button><span>${item.qty}</span><button data-action="cart-plus" data-id="${safe(item.productId)}">＋</button></div></td><td>${money(Number(item.product.price)*item.qty)}</td><td><button class="delete-btn" data-action="cart-delete" data-id="${safe(item.productId)}" aria-label="상품 삭제">×</button></td></tr>`).join("")}</tbody></table><div class="cart-summary"><div class="summary-line"><span>상품 금액</span><b>${money(subtotal)}</b></div><div class="summary-line"><span>배송비</span><b>${subtotal>=50000?"무료":money(subtotal?3000:0)}</b></div><div class="summary-line summary-total"><span>총 결제 예정 금액</span><b>${money(subtotal+(subtotal>=50000||!subtotal?0:3000))}</b></div><button class="primary-button" data-action="checkout">체험 결제하기</button></div>`:`<div class="empty-state"><b>장바구니가 비어 있습니다.</b>마음에 드는 상품을 담아보세요.<br><button class="outline-button" style="margin-top:20px" data-view="products">쇼핑 계속하기</button></div>`}</section>`;
}
function renderAuth(mode) {
  const signup = mode === "signup";
  app.innerHTML = `<section class="page-shell"><div class="page-title"><span>WELCOME TO PRIDE</span><h1>${signup?"CREATE ACCOUNT":"MEMBER LOGIN"}</h1></div><form class="form-card" id="authForm"><h2>${signup?"회원가입":"로그인"}</h2>${signup?`<div class="form-field"><label for="name">이름</label><input id="name" name="name" required maxlength="20" placeholder="이름을 입력하세요"></div><div class="form-field"><label for="phone">연락처</label><input id="phone" name="phone" type="tel" required maxlength="20" placeholder="연락처를 입력하세요"></div>`:""}<div class="form-field"><label for="email">이메일</label><input id="email" name="email" type="email" required placeholder="example@email.com"></div><div class="form-field"><label for="password">비밀번호</label><input id="password" name="password" type="password" required minlength="6" placeholder="${signup?"비밀번호 6자 이상 입력":"비밀번호를 입력하세요"}"></div>${signup?`<div class="notice">가입 즉시 3,000P가 지급됩니다. 비밀번호는 6자 이상 입력해 주세요.</div>`:""}<button class="primary-button" type="submit">${signup?"3,000P 받고 가입하기":"로그인"}</button><p class="form-note">${signup?`이미 회원이신가요? <button type="button" data-view="login">로그인</button>`:`아직 회원이 아니신가요? <button type="button" data-view="signup">회원가입</button>`}</p></form></section>`;
}

async function renderMypage(tab=mypageTab) {
  if (authInitialization) await authInitialization;
  if (!session?.user) { navigate("login"); toast("마이페이지는 로그인 후 이용할 수 있습니다."); return; }
  const user = await loadProfile();
  if (!user) { toast("회원 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."); return; }
  mypageTab = tab;

  let orderList = [];
  let orderError = null;
  if (tab === "orders") {
    const { data, error } = await db.from("shop_orders")
      .select("id, total, status, created_at, shop_order_items(qty, unit_price, shop_products(name))")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });
    orderError = error;
    orderList = data || [];
  }

  const content = tab === "orders"
    ? (orderError
      ? `<div class="notice" role="alert">주문 내역을 불러오지 못했습니다. ${safe(orderError.message)}</div>`
      : (orderList.length
        ? orderList.map(order => {
            const details = order.shop_order_items || [];
            const itemText = details.length
              ? details.map(item => `${safe(item.shop_products?.name || "상품 정보 없음")} ${Number(item.qty)}개`).join(", ")
              : "주문 상품 정보가 없습니다.";
            return `<div class="order-item"><div><b>주문번호 ${safe(order.id)}</b><small>${new Date(order.created_at).toLocaleString("ko-KR")}<br>${itemText}</small></div><div><b>${money(order.total)}</b><small class="order-status">${safe(order.status || "결제완료")}</small></div></div>`;
          }).join("")
        : `<div class="empty-state"><b>아직 주문 내역이 없습니다.</b>첫 쇼핑을 시작해 보세요.</div>`))
    : `<div class="notice">현재 회원 등급은 ${safe(displayGrade(user.grade))}입니다. 등급과 포인트는 데이터베이스에서 관리됩니다.</div>${["WELCOME","SILVER","GOLD","VIP"].map(g=>`<div class="order-item"><b>${g}</b>${user.grade===g?`<span class="order-status">현재 등급</span>`:""}</div>`).join("")}`;

  app.innerHTML = `<section class="page-shell"><div class="page-title"><span>YOUR PRIDE</span><h1>MY PAGE</h1></div><div class="mypage-grid"><aside class="member-card"><span class="grade">${safe(displayGrade(user.grade))} MEMBER</span><div class="member-name">${safe(user.name)} 님</div><div>${safe(user.email)}</div><div class="point-number">${Number(user.points || 0).toLocaleString("ko-KR")} P</div><small>사용 가능 포인트</small></aside><div class="mypage-content"><form class="form-card" id="profileForm"><h3>회원 정보 수정</h3><div class="form-field"><label for="profileName">이름</label><input id="profileName" name="name" required maxlength="20" value="${safe(user.name || "")}"></div><div class="form-field"><label for="profileEmail">이메일</label><input id="profileEmail" type="email" value="${safe(user.email || "")}" disabled></div><div class="form-field"><label for="profilePhone">연락처</label><input id="profilePhone" name="phone" type="tel" maxlength="20" value="${safe(user.phone || "")}" placeholder="연락처를 입력하세요"></div><button class="primary-button" type="submit">회원 정보 저장</button></form><div class="mypage-tabs"><button class="${tab==="orders"?"active":""}" data-tab="orders">주문 내역</button><button class="${tab==="grade"?"active":""}" data-tab="grade">회원 등급 안내</button></div><h3>${tab==="orders"?"ORDER HISTORY":"MEMBERSHIP BENEFIT"}</h3>${content}</div></div></section>`;
}
function navigate(view, data) {
  document.querySelectorAll(".nav-link").forEach(link=>link.classList.toggle("active",link.dataset.view===view));
  if(view!=="home") clearInterval(slideTimer);
  if(view==="home") renderHome();
  else if(view==="products") { activeCategory="ALL"; searchKeyword=""; renderProducts(); }
  else if(view==="detail") renderDetail(data);
  else if(view==="cart") renderCart();
  else if(view==="login"||view==="signup") renderAuth(view);
  else if(view==="mypage") renderMypage();
  $("#mainNav").classList.remove("open"); window.scrollTo({top:0,behavior:"smooth"}); app.focus({preventScroll:true}); updateHeader();
}
function addToCart(id, qty=1) {
  const product = productCache.get(String(id));
  if (!product) return toast("상품 정보를 불러오지 못했습니다. 다시 시도해 주세요.");
  if (!product.is_active) return toast("현재 판매하지 않는 상품입니다.");
  if (Number(product.stock) <= 0) return toast("품절된 상품입니다.");
  const found = cart.find(item => String(item.productId) === String(product.id));
  if (found) found.qty += qty;
  else cart.push({ productId: product.id, qty });
  persist(); updateHeader(); toast("장바구니에 상품을 담았습니다.");
}
function changeCart(id, delta) {
  const item = cart.find(i => String(i.productId) === String(id));
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  persist(); renderCart(); updateHeader();
}
async function checkout() {
  if (isCheckingOut) return;
  // 인증 상태를 다시 확인해 로그인 여부를 검증합니다.
  const { data: sessionData, error: sessionError } = await db.auth.getSession();
  if (sessionError || !sessionData?.session?.user) {
    toast("주문하려면 먼저 로그인해 주세요.");
    navigate("login");
    return;
  }
  session = sessionData.session;
  if (!cart.length) return toast("장바구니가 비어 있습니다.");

  isCheckingOut = true;
  const button = document.querySelector('[data-action="checkout"]');
  if (button) { button.disabled = true; button.textContent = "주문 저장 중..."; }

  try {
    // 중복 상품은 product_id 기준으로 수량을 합칩니다.
    const qtyByProduct = new Map();
    for (const item of cart) {
      const key = String(item.productId);
      qtyByProduct.set(key, (qtyByProduct.get(key) || 0) + Number(item.qty || 1));
    }
    const productIds = [...qtyByProduct.keys()];
    const { data: products, error: productError } = await db.from("shop_products")
      .select("id, name, price, is_active")
      .in("id", productIds);
    if (productError) throw new Error(`상품 정보를 확인하지 못했습니다: ${productError.message}`);

    const productById = new Map((products || []).map(product => [String(product.id), product]));
    const orderItems = productIds.map(id => {
      const product = productById.get(id);
      if (!product || !product.is_active) throw new Error("장바구니에 판매하지 않는 상품이 포함되어 있습니다. 장바구니를 확인해 주세요.");
      const qty = qtyByProduct.get(id);
      const unitPrice = Number(product.price);
      if (!Number.isFinite(unitPrice) || !Number.isFinite(qty) || qty < 1) {
        throw new Error("상품 가격 또는 수량이 올바르지 않습니다.");
      }
      return {
        product_id: product.id,
        qty,
        unit_price: unitPrice,
        name: product.name
      };
    });

    // total은 모든 주문 상세의 수량 × 단가 합계이며 배송비를 별도로 더하지 않습니다.
    const total = orderItems.reduce((sum, item) => sum + item.qty * item.unit_price, 0);
    const { data: order, error: orderError } = await db.from("shop_orders")
      .insert({ total })
      .select("id, total, created_at")
      .single();
    if (orderError) throw new Error(`주문 저장에 실패했습니다: ${orderError.message}`);

    const detailRows = orderItems.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      qty: item.qty,
      unit_price: item.unit_price
    }));
    const { error: detailError } = await db.from("shop_order_items").insert(detailRows);
    if (detailError) {
      // 상세 저장 실패 시 주문 헤더를 되돌릴 수 있으면 정리합니다.
      const { error: rollbackError } = await db.from("shop_orders").delete().eq("id", order.id);
      if (rollbackError) console.error("주문 헤더 정리 실패:", rollbackError.message);
      throw new Error(`주문 상품 저장에 실패했습니다: ${detailError.message}`);
    }

    // 두 테이블 저장이 모두 성공한 경우에만 장바구니를 비웁니다.
    cart = [];
    persist();
    updateHeader();
    const estimatedPoints = Math.floor(total * 0.01); // 화면 표시용 임시 예상치(1%); DB에는 저장하지 않음
    app.innerHTML = `<section class="page-shell"><div class="order-complete"><div class="check">✓</div><h2>주문이 완료되었습니다.</h2><p>PRIDE를 이용해 주셔서 감사합니다.</p><div class="notice">주문번호 <b>${safe(order.id)}</b><br>주문 합계 ${money(total)}<br>적립 예정 ${estimatedPoints.toLocaleString("ko-KR")}P<br><small>실제 결제는 진행되지 않은 체험 주문입니다.</small></div><button class="primary-button" style="padding:13px 25px" data-view="mypage">주문 내역 확인</button></div></section>`;
    window.scrollTo({top:0,behavior:"smooth"});
  } catch (error) {
    console.error("체험 주문 저장 오류:", error);
    // 장바구니는 그대로 유지하고 현재 화면에 오류를 표시합니다.
    await renderCart();
    const message = safe(error?.message || "알 수 없는 오류가 발생했습니다.");
    const notice = document.createElement("div");
    notice.className = "notice";
    notice.setAttribute("role", "alert");
    notice.textContent = `주문 저장에 실패했습니다. ${message} 장바구니는 유지되었습니다.`;
    const shell = app.querySelector(".page-shell");
    if (shell) shell.insertBefore(notice, shell.children[1] || null);
  } finally {
    isCheckingOut = false;
  }
}

document.addEventListener("click", event=>{
  const view=event.target.closest("[data-view]"); if(view){event.preventDefault();navigate(view.dataset.view);return;}
  const category=event.target.closest("[data-category]"); if(category){activeCategory=category.dataset.category;searchKeyword="";navigate("products");activeCategory=category.dataset.category;document.querySelectorAll("[data-filter]").forEach(b=>b.classList.toggle("active",b.dataset.filter===activeCategory));drawProductList();return;}
  const product=event.target.closest("[data-product]"); if(product){navigate("detail",product.dataset.product);return;}
  const filter=event.target.closest("[data-filter]"); if(filter){activeCategory=filter.dataset.filter;document.querySelectorAll("[data-filter]").forEach(b=>b.classList.toggle("active",b===filter));drawProductList();return;}
  const slide=event.target.closest("[data-slide]"); if(slide){showSlide(Number(slide.dataset.slide));clearInterval(slideTimer);slideTimer=setInterval(()=>showSlide(slideIndex+1),6000);return;}
  const tab=event.target.closest("[data-tab]"); if(tab){renderMypage(tab.dataset.tab);return;}
  const action=event.target.closest("[data-action]"); if(!action)return;
  const id=action.dataset.id;
  switch(action.dataset.action){
    case "slide-prev":showSlide(slideIndex-1);clearInterval(slideTimer);slideTimer=setInterval(()=>showSlide(slideIndex+1),6000);break;
    case "slide-next":showSlide(slideIndex+1);clearInterval(slideTimer);slideTimer=setInterval(()=>showSlide(slideIndex+1),6000);break;
    case "logout":(async()=>{const {error}=await db.auth.signOut();if(error){toast(authErrorMessage(error));return;}session=null;profile=null;updateHeader();toast("로그아웃되었습니다.");navigate("home");})();break;
    case "search":searchKeyword=$("#productSearch").value.trim();drawProductList();break;
    case "detail-minus":detailQty=Math.max(1,detailQty-1);if($("#detailQty"))$("#detailQty").textContent=detailQty;break;
    case "detail-plus":detailQty+=1;if($("#detailQty"))$("#detailQty").textContent=detailQty;break;
    case "add-cart":addToCart(id,detailQty);break;
    case "buy-now":addToCart(id,detailQty);navigate("cart");break;
    case "cart-minus":changeCart(id,-1);break;
    case "cart-plus":changeCart(id,1);break;
    case "cart-delete":cart=cart.filter(item=>String(item.productId)!==String(id));persist();renderCart();updateHeader();toast("상품을 삭제했습니다.");break;
    case "checkout":checkout();break;
  }
});
document.addEventListener("submit", async event=>{
  if(event.target.id==="authForm"){
    event.preventDefault();
    const form=new FormData(event.target);
    const email=String(form.get("email")).trim().toLowerCase();
    const password=String(form.get("password"));

    if(event.target.querySelector("#name")){
      const name=String(form.get("name")).trim();
      const phone=String(form.get("phone")).trim();
      if(password.length<6){toast("비밀번호는 6자 이상 입력해 주세요.");return;}
      const {data,error}=await db.auth.signUp({email,password,options:{data:{name,phone}}});
      if(error){toast(authErrorMessage(error));return;}
      if(data.session){
        session=data.session;
        await loadProfile();
        toast("회원가입이 완료되었습니다. 3,000P가 지급되었습니다.");
        navigate("mypage");
      } else {
        toast("가입 신청이 완료되었습니다. 이메일 인증 후 로그인해 주세요.");
        navigate("login");
      }
    } else {
      const {data,error}=await db.auth.signInWithPassword({email,password});
      if(error){toast(authErrorMessage(error));return;}
      session=data.session;
      await loadProfile();
      toast("로그인되었습니다.");
      navigate("mypage");
    }
    return;
  }

  if(event.target.id==="profileForm"){
    event.preventDefault();
    if(!session?.user){navigate("login");return;}
    const form=new FormData(event.target);
    const name=String(form.get("name")).trim();
    const phone=String(form.get("phone")).trim();
    const {data,error}=await db.from("shop_profiles")
      .update({name,phone})
      .eq("id",session.user.id)
      .select("id, email, name, phone, grade, points, role, created_at")
      .single();
    if(error){toast("회원 정보 저장에 실패했습니다. 다시 시도해 주세요.");console.error(error.message);return;}
    profile=data;
    updateHeader();
    toast("회원 정보가 저장되었습니다.");
    renderMypage(mypageTab);
  }
});
document.addEventListener("input",event=>{if(event.target.id==="productSearch"){searchKeyword=event.target.value.trim();drawProductList();}});
document.addEventListener("change",event=>{
  if(event.target.id==="sortProducts")drawProductList();
});
$("#menuToggle").addEventListener("click",()=>$("#mainNav").classList.toggle("open"));
$("#toTop").addEventListener("click",()=>window.scrollTo({top:0,behavior:"smooth"}));
$("#modalClose").addEventListener("click",()=>$("#modalBackdrop").hidden=true); $("#modalBackdrop").addEventListener("click",event=>{if(event.target.id==="modalBackdrop")event.currentTarget.hidden=true;});
// 모든 페이지 진입 시 Supabase 세션을 확인합니다.
renderHome();
updateHeader();
authInitialization = refreshAuthSession();
