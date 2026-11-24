
/* ==========================================
   PRIDE SHOP
   Supabase 상품 및 회원 인증 연결
========================================== */

let PRODUCTS = [];
let CATEGORIES = ["ALL"];

let currentView = "home";
let currentDetailId = null;
let currentSession = null;
let currentProfile = null;

let cart = readStorage("pride_cart", []);
let orders = readStorage("pride_orders", []);

let activeCategory = "ALL";
let searchKeyword = "";
let slideIndex = 0;
let slideTimer = null;
let toastTimer = null;
let detailQty = 1;
let mypageTab = "orders";

const app = document.getElementById("app");
const $ = selector => document.querySelector(selector);

const money = value =>
  new Intl.NumberFormat("ko-KR").format(Number(value) || 0) + "원";

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveStorage() {
  // 회원 정보 및 비밀번호는 저장하지 않습니다.
  localStorage.setItem("pride_cart", JSON.stringify(cart));
  localStorage.setItem("pride_orders", JSON.stringify(orders));
}

function safe(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function toast(message) {
  const el = $("#toast");
  if (!el) return;

  el.textContent = message;
  el.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(
    () => el.classList.remove("show"),
    2800
  );
}

/* ==========================================
   한글 오류 안내
========================================== */

function authErrorMessage(error) {
  const message = String(error?.message || "").toLowerCase();

  if (
    message.includes("invalid login credentials") ||
    message.includes("invalid credentials")
  ) {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }

  if (message.includes("user already registered")) {
    return "이미 가입된 이메일입니다.";
  }

  if (message.includes("password should be at least")) {
    return "비밀번호는 6자 이상 입력해 주세요.";
  }

  if (message.includes("email not confirmed")) {
    return "이메일 인증을 완료한 후 로그인해 주세요.";
  }

  if (message.includes("invalid email")) {
    return "올바른 이메일 주소를 입력해 주세요.";
  }

  if (message.includes("rate limit")) {
    return "요청 횟수가 초과되었습니다. 잠시 후 다시 시도해 주세요.";
  }

  if (message.includes("network")) {
    return "네트워크 연결을 확인해 주세요.";
  }

  return "요청을 처리하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.";
}

/* ==========================================
   Supabase 회원 정보
========================================== */

async function loadMyProfile(userId) {
  if (!userId) {
    currentProfile = null;
    updateHeader();
    return null;
  }

  try {
    const { data, error } = await db
      .from("shop_profiles")
      .select("id, email, name, phone, grade, points, role")
      .eq("id", userId)
      .single();

    if (error) throw error;

    currentProfile = data;
    updateHeader();

    return data;
  } catch (error) {
    console.error("회원 정보 조회 오류:", error);
    currentProfile = null;
    updateHeader();
    return null;
  }
}

async function initializeAuth() {
  try {
    const { data, error } = await db.auth.getSession();

    if (error) throw error;

    currentSession = data.session;

    if (currentSession?.user) {
      await loadMyProfile(currentSession.user.id);
    } else {
      currentProfile = null;
      updateHeader();
    }
  } catch (error) {
    console.error("로그인 상태 확인 오류:", error);
    toast("로그인 상태를 확인하지 못했습니다.");
  }

  db.auth.onAuthStateChange(async (event, session) => {
    currentSession = session;

    if (session?.user) {
      await loadMyProfile(session.user.id);
    } else {
      currentProfile = null;
      updateHeader();
    }

    if (event === "SIGNED_OUT") {
      updateHeader();
    }
  });
}

/* ==========================================
   헤더
========================================== */

function updateHeader() {
  const accountLinks = $("#accountLinks");

  if (accountLinks) {
    accountLinks.innerHTML = currentSession && currentProfile
      ? `
        <span>${safe(currentProfile.name)} 님</span>
        <span>·</span>
        <button data-action="logout">로그아웃</button>
      `
      : `
        <button data-view="login">로그인</button>
        <span>·</span>
        <button data-view="signup">회원가입</button>
      `;
  }

  const count = $("#cartCount");

  if (count) {
    count.textContent = cart.reduce(
      (sum, item) => sum + Number(item.qty || 0),
      0
    );
  }
}

/* ==========================================
   Supabase 상품 조회
========================================== */

async function loadProducts() {
  try {
    const { data, error } = await db
      .from("shop_products")
      .select("id, name, category, price, stock, image_url, is_active")
      .eq("is_active", true)
      .order("id", { ascending: true });

    if (error) throw error;

    PRODUCTS = data || [];

    CATEGORIES = [
      "ALL",
      ...new Set(PRODUCTS.map(p => p.category).filter(Boolean))
    ];

    renderCategoryNavigation();

    if (currentView === "home") renderHome();
    else if (currentView === "products") renderProducts();
    else if (currentView === "detail") renderDetail(currentDetailId);
    else if (currentView === "cart") renderCart();

  } catch (error) {
    console.error("상품 조회 오류:", error);
    toast("상품 목록을 불러오지 못했습니다.");
  }
}

function renderCategoryNavigation() {
  const nav = $("#categoryNavItems");
  if (!nav) return;

  nav.innerHTML = CATEGORIES.slice(1).map(category => `
    <button class="nav-link"
      data-category="${safe(category)}">
      ${safe(category)}
    </button>
  `).join("");
}

/* ==========================================
   메인 배너
========================================== */

function startSlides() {
  const slides = [
    {
      image: "img/banner/banner1.jpg",
      eyebrow: "THE NEW CLASSIC",
      title: "PRIDE",
      text: "당신의 오늘을 더 우아하게"
    },
    {
      image: "img/banner/banner2.jpg",
      eyebrow: "TIMELESS ELEGANCE",
      title: "A QUIET LUXURY",
      text: "시간이 지나도 변하지 않는 아름다움"
    },
    {
      image: "img/banner/banner3.jpg",
      eyebrow: "MADE FOR YOUR MOMENTS",
      title: "OWN YOUR STYLE",
      text: "당신만의 분위기를 완성하는 선택"
    },
    {
      image: "img/banner/banner4.jpg",
      eyebrow: "THE PRIDE EDIT",
      title: "ELEGANCE, EVERYDAY",
      text: "일상에 자연스럽게 스며드는 우아함"
    }
  ];

  $("#heroSlides").innerHTML = slides.map((slide, i) => `
    <article class="hero-slide ${i === 0 ? "active" : ""}"
      style="background-image:url('${slide.image}')">
      <div class="hero-copy">
        <span class="eyebrow">${slide.eyebrow}</span>
        <h1>${slide.title}</h1>
        <p>${slide.text}</p>
        <button data-view="products">SHOP THE COLLECTION　→</button>
      </div>
    </article>
  `).join("");

  $("#slideDots").innerHTML = slides.map((_, i) => `
    <button class="${i === 0 ? "active" : ""}"
      data-slide="${i}" aria-label="${i + 1}번 배너"></button>
  `).join("");

  clearInterval(slideTimer);
  slideTimer = setInterval(
    () => showSlide((slideIndex + 1) % slides.length),
    6000
  );
}

function showSlide(index) {
  const slides = [...document.querySelectorAll(".hero-slide")];

  if (!slides.length) return;

  slideIndex = (index + slides.length) % slides.length;

  slides.forEach((slide, i) =>
    slide.classList.toggle("active", i === slideIndex)
  );

  document.querySelectorAll("[data-slide]").forEach((dot, i) =>
    dot.classList.toggle("active", i === slideIndex)
  );
}

/* ==========================================
   상품 카드
========================================== */

function productCard(product) {
  return `
    <article class="product-card"
      data-product="${product.id}"
      tabindex="0"
      aria-label="${safe(product.name)} 상세 보기">

      <div class="product-image">
        <img src="${safe(product.image_url)}"
          alt="${safe(product.name)}" loading="lazy">
      </div>

      <div class="product-info">
        <span class="product-category">${safe(product.category)}</span>
        <div class="product-name">${safe(product.name)}</div>
        <div class="product-price">${money(product.price)}</div>
        <div class="product-desc">PRIDE PREMIUM COLLECTION</div>
      </div>
    </article>
  `;
}

/* ==========================================
   메인 화면
========================================== */

function renderHome() {
  currentView = "home";

  app.innerHTML = `
    <section class="hero" id="hero" aria-label="PRIDE 메인 배너">
      <div class="hero-slides" id="heroSlides"></div>
      <button class="slide-arrow prev" data-action="slide-prev"
        aria-label="이전 배너">‹</button>
      <button class="slide-arrow next" data-action="slide-next"
        aria-label="다음 배너">›</button>
      <div class="slide-dots" id="slideDots"></div>
    </section>

    <section class="benefits wrap">
      <div><span class="benefit-icon">◇</span><p><b>FREE SHIPPING</b><small>5만원 이상 무료배송</small></p></div>
      <div><span class="benefit-icon">♧</span><p><b>WELCOME POINT</b><small>신규 가입 시 3,000P</small></p></div>
      <div><span class="benefit-icon">♕</span><p><b>MEMBERSHIP</b><small>등급별 최대 7% 적립</small></p></div>
      <div><span class="benefit-icon">♡</span><p><b>PRIDE SERVICE</b><small>언제나 세심한 스타일링</small></p></div>
    </section>

    <section class="category-section wrap">
      <div class="section-heading">
        <span>CURATED FOR YOU</span>
        <h2>SHOP BY CATEGORY</h2>
        <p>일상에 우아함을 더하는 PRIDE의 셀렉션</p>
      </div>
      <div class="category-grid" id="categoryGrid"></div>
    </section>

    <section class="products-section wrap">
      <div class="section-heading">
        <span>THE PRIDE EDIT</span>
        <h2>BEST COLLECTION</h2>
        <p>지금 가장 사랑받는 아이템을 만나보세요.</p>
      </div>
      <div class="product-grid" id="homeProducts"></div>
      <button class="outline-button center-button" data-view="products">
        전체 상품 보기 <span>→</span>
      </button>
    </section>

    <section class="brand-banner wrap">
      <div>
        <span>THE ART OF EVERYDAY</span>
        <h2>Elegance is an attitude.</h2>
        <p>당신만의 분위기를 완성하는 가장 아름다운 선택.</p>
        <button class="gold-button" data-view="products">
          PRIDE COLLECTION <span>→</span>
        </button>
      </div>
    </section>
  `;

  startSlides();

  $("#categoryGrid").innerHTML = CATEGORIES.slice(1).map(category => {
    const product = PRODUCTS.find(p => p.category === category);

    return `
      <article class="category-card"
        data-category="${safe(category)}">
        <img src="${safe(product?.image_url || "")}"
          alt="${safe(category)}" loading="lazy">
        <div>
          <b>${safe(category)}</b>
          <span>DISCOVER　→</span>
        </div>
      </article>
    `;
  }).join("");

  $("#homeProducts").innerHTML = PRODUCTS
    .slice(0, 4)
    .map(productCard)
    .join("");

  renderCategoryNavigation();
}

/* ==========================================
   상품 목록
========================================== */

function renderProducts() {
  currentView = "products";

  app.innerHTML = `
    <section class="page-shell">
      <div class="page-title">
        <span>PRIDE COLLECTION</span>
        <h1>SHOP ALL</h1>
        <p>당신의 스타일을 완성할 아이템</p>
      </div>

      <div class="toolbar">
        <div class="filter-row">
          ${CATEGORIES.map(category => `
            <button class="filter-chip ${activeCategory === category ? "active" : ""}"
              data-filter="${safe(category)}">${safe(category)}</button>
          `).join("")}
        </div>

        <div class="search-box">
          <input id="productSearch" type="search"
            placeholder="상품명을 검색하세요"
            value="${safe(searchKeyword)}">
          <button data-action="search">⌕</button>
        </div>
      </div>

      <div class="toolbar">
        <span id="resultCount" class="product-desc"></span>
        <select class="sort-select" id="sortProducts">
          <option value="default">추천순</option>
          <option value="low">낮은 가격순</option>
          <option value="high">높은 가격순</option>
          <option value="name">상품명순</option>
        </select>
      </div>

      <div class="product-grid" id="allProducts"></div>
    </section>
  `;

  drawProductList();
}

function drawProductList() {
  let list = PRODUCTS.filter(product =>
    (activeCategory === "ALL" || product.category === activeCategory) &&
    product.name.toLowerCase().includes(searchKeyword.toLowerCase())
  );

  const sort = $("#sortProducts")?.value;

  if (sort === "low") list.sort((a, b) => a.price - b.price);
  if (sort === "high") list.sort((a, b) => b.price - a.price);
  if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name, "ko"));

  $("#resultCount").textContent = `TOTAL ${list.length} ITEMS`;

  $("#allProducts").innerHTML = list.length
    ? list.map(productCard).join("")
    : `<div class="empty-state" style="grid-column:1/-1">
        <b>검색 결과가 없습니다.</b>다른 검색어를 입력해 주세요.
      </div>`;
}

/* ==========================================
   상품 상세
========================================== */

function renderDetail(id) {
  currentView = "detail";
  currentDetailId = id;

  const product = PRODUCTS.find(
    p => String(p.id) === String(id)
  );

  if (!product) return navigate("products");

  detailQty = 1;

  app.innerHTML = `
    <section class="page-shell">
      <div class="page-title">
        <span>PRIDE COLLECTION</span>
        <h1>PRODUCT DETAIL</h1>
      </div>

      <div class="detail-layout">
        <div class="detail-image">
          <img src="${safe(product.image_url)}"
            alt="${safe(product.name)}">
        </div>

        <div class="detail-copy">
          <span class="product-category">${safe(product.category)}</span>
          <h1>${safe(product.name)}</h1>
          <div class="detail-price">${money(product.price)}</div>

          <div class="detail-description">
            고급스러운 소재와 섬세한 디테일로 완성한 PRIDE의 시그니처 아이템입니다.
          </div>

          <div class="detail-row">
            <span>배송</span><span>5만원 이상 무료배송</span>
          </div>

          <div class="detail-row">
            <span>재고</span><span>${Number(product.stock) || 0}개</span>
          </div>

          <div class="qty-control">
            <button data-action="detail-minus">−</button>
            <span id="detailQty">1</span>
            <button data-action="detail-plus">＋</button>
          </div>

          <div class="action-row">
            <button class="secondary-button"
              data-action="add-cart" data-id="${product.id}">
              장바구니 담기
            </button>
            <button class="primary-button"
              data-action="buy-now" data-id="${product.id}">
              바로 구매
            </button>
          </div>
        </div>
      </div>
    </section>
  `;
}

/* ==========================================
   장바구니
========================================== */

function renderCart() {
  currentView = "cart";

  const items = cart.map(item => ({
    ...item,
    product: PRODUCTS.find(
      p => String(p.id) === String(item.productId)
    )
  })).filter(item => item.product);

  const subtotal = items.reduce(
    (sum, item) => sum + item.product.price * item.qty,
    0
  );

  app.innerHTML = `
    <section class="page-shell">
      <div class="page-title">
        <span>YOUR SELECTION</span>
        <h1>SHOPPING BAG</h1>
      </div>

      ${items.length ? `
        <table class="cart-table">
          <thead>
            <tr>
              <th>상품 정보</th>
              <th>가격</th>
              <th>수량</th>
              <th>합계</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td>
                  <div class="cart-product">
                    <img src="${safe(item.product.image_url)}" alt="">
                    <div>
                      <b>${safe(item.product.name)}</b>
                      <small>${safe(item.product.category)}</small>
                    </div>
                  </div>
                </td>
                <td>${money(item.product.price)}</td>
                <td>
                  <div class="cart-qty">
                    <button data-action="cart-minus"
                      data-id="${item.productId}">−</button>
                    <span>${item.qty}</span>
                    <button data-action="cart-plus"
                      data-id="${item.productId}">＋</button>
                  </div>
                </td>
                <td>${money(item.product.price * item.qty)}</td>
                <td>
                  <button class="delete-btn"
                    data-action="cart-delete"
                    data-id="${item.productId}">×</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <div class="cart-summary">
          <div class="summary-line">
            <span>상품 금액</span><b>${money(subtotal)}</b>
          </div>
          <div class="summary-line">
            <span>배송비</span>
            <b>${subtotal >= 50000 ? "무료" : money(3000)}</b>
          </div>
          <div class="summary-line summary-total">
            <span>총 결제 예정 금액</span>
            <b>${money(subtotal + (subtotal >= 50000 ? 0 : 3000))}</b>
          </div>
          <button class="primary-button" data-action="checkout">
            체험 결제하기
          </button>
        </div>
      ` : `
        <div class="empty-state">
          <b>장바구니가 비어 있습니다.</b>
          마음에 드는 상품을 담아보세요.
          <br>
          <button class="outline-button"
            style="margin-top:20px"
            data-view="products">쇼핑 계속하기</button>
        </div>
      `}
    </section>
  `;
}

function addToCart(id, qty = 1) {
  const product = PRODUCTS.find(
    p => String(p.id) === String(id)
  );

  if (!product) return;

  if (Number(product.stock) <= 0) {
    return toast("현재 재고가 없는 상품입니다.");
  }

  const found = cart.find(
    item => String(item.productId) === String(product.id)
  );

  if (qty + (found?.qty || 0) > Number(product.stock)) {
    return toast("상품 재고가 부족합니다.");
  }

  if (found) found.qty += qty;
  else cart.push({ productId: product.id, qty });

  saveStorage();
  updateHeader();
  toast("상품을 장바구니에 담았습니다.");
}

function changeCart(id, delta) {
  const item = cart.find(
    i => String(i.productId) === String(id)
  );

  const product = PRODUCTS.find(
    p => String(p.id) === String(id)
  );

  if (!item || !product) return;

  item.qty = Math.max(
    1,
    Math.min(Number(product.stock), item.qty + delta)
  );

  saveStorage();
  renderCart();
  updateHeader();
}

/* ==========================================
   로그인 / 회원가입 화면
========================================== */

function renderAuth(mode) {
  currentView = mode;

  const signup = mode === "signup";

  app.innerHTML = `
    <section class="page-shell">
      <div class="page-title">
        <span>WELCOME TO PRIDE</span>
        <h1>${signup ? "CREATE ACCOUNT" : "MEMBER LOGIN"}</h1>
      </div>

      <form class="form-card" id="authForm">
        <h2>${signup ? "회원가입" : "로그인"}</h2>

        ${signup ? `
          <div class="form-field">
            <label for="name">이름</label>
            <input id="name" name="name"
              required maxlength="20"
              placeholder="이름을 입력하세요">
          </div>

          <div class="form-field">
            <label for="phone">연락처</label>
            <input id="phone" name="phone"
              type="tel" required
              placeholder="010-0000-0000">
          </div>
        ` : ""}

        <div class="form-field">
          <label for="email">이메일</label>
          <input id="email" name="email"
            type="email" required
            placeholder="example@email.com">
        </div>

        <div class="form-field">
          <label for="password">비밀번호</label>
          <input id="password" name="password"
            type="password" required
            minlength="6"
            placeholder="${signup ? "비밀번호 6자 이상" : "비밀번호를 입력하세요"}">
          ${signup ? `<small>비밀번호는 6자 이상 입력해 주세요.</small>` : ""}
        </div>

        ${signup ? `
          <div class="notice">
            회원가입 후 회원 정보가 자동으로 등록됩니다.
          </div>
        ` : ""}

        <button class="primary-button" type="submit">
          ${signup ? "회원가입" : "로그인"}
        </button>

        <p class="form-note">
          ${signup
            ? `이미 회원이신가요? <button type="button" data-view="login">로그인</button>`
            : `아직 회원이 아니신가요? <button type="button" data-view="signup">회원가입</button>`
          }
        </p>
      </form>
    </section>
  `;
}

/* ==========================================
   Supabase 회원가입
========================================== */

async function signUp(form) {
  const name = String(form.get("name") || "").trim();
  const phone = String(form.get("phone") || "").trim();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");

  if (!name || !phone || !email || !password) {
    return toast("모든 항목을 입력해 주세요.");
  }

  if (password.length < 6) {
    return toast("비밀번호는 6자 이상 입력해 주세요.");
  }

  try {
    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          phone
        }
      }
    });

    if (error) throw error;

    if (data.session) {
      currentSession = data.session;
      await loadMyProfile(data.user.id);

      toast("회원가입이 완료되었습니다.");
      navigate("home");
    } else {
      toast("회원가입이 완료되었습니다. 이메일 인증 후 로그인해 주세요.");
      navigate("login");
    }

  } catch (error) {
    console.error("회원가입 오류:", error);
    toast(authErrorMessage(error));
  }
}

/* ==========================================
   Supabase 로그인
========================================== */

async function signIn(form) {
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");

  if (!email || !password) {
    return toast("이메일과 비밀번호를 입력해 주세요.");
  }

  try {
    const { data, error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    currentSession = data.session;
    const profile = await loadMyProfile(data.user.id);

    if (!profile) {
      toast("회원 정보를 불러오지 못했습니다. 관리자에게 문의해 주세요.");
      return;
    }

    toast("로그인되었습니다.");
    navigate("home");

  } catch (error) {
    console.error("로그인 오류:", error);
    toast(authErrorMessage(error));
  }
}

/* ==========================================
   Supabase 로그아웃
========================================== */

async function signOut() {
  try {
    const { error } = await db.auth.signOut();

    if (error) throw error;

    currentSession = null;
    currentProfile = null;

    updateHeader();
    toast("로그아웃되었습니다.");
    navigate("home");

  } catch (error) {
    console.error("로그아웃 오류:", error);
    toast("로그아웃에 실패했습니다. 다시 시도해 주세요.");
  }
}

/* ==========================================
   마이페이지
========================================== */

async function renderMypage(tab = mypageTab) {
  currentView = "mypage";
  mypageTab = tab;

  if (!currentSession?.user) {
    toast("로그인이 필요한 서비스입니다.");
    return navigate("login");
  }

  const profile = await loadMyProfile(currentSession.user.id);

  if (!profile) {
    toast("회원 정보를 불러오지 못했습니다.");
    return;
  }

  const myOrders = orders.filter(
    order => order.userId === currentSession.user.id
  );

  const content = tab === "orders"
    ? (
      myOrders.length
        ? myOrders.slice().reverse().map(order => `
          <div class="order-item">
            <div>
              <b>주문번호 ${safe(order.id)}</b>
              <small>
                ${new Date(order.date).toLocaleString("ko-KR")} ·
                ${order.items.map(item => safe(item.name)).join(", ")}
              </small>
            </div>
            <div>
              <b>${money(order.total)}</b>
              <small class="order-status">${safe(order.status)}</small>
            </div>
          </div>
        `).join("")
        : `
          <div class="empty-state">
            <b>아직 주문 내역이 없습니다.</b>
            첫 쇼핑을 시작해 보세요.
          </div>
        `
    )
    : `
      <div class="notice">
        현재 회원 등급과 포인트는 Supabase 회원 정보를 기준으로 표시됩니다.
      </div>
    `;

  app.innerHTML = `
    <section class="page-shell">
      <div class="page-title">
        <span>YOUR PRIDE</span>
        <h1>MY PAGE</h1>
      </div>

      <div class="mypage-grid">
        <aside class="member-card">
          <span class="grade">${safe(profile.grade || "WELCOME")} MEMBER</span>
          <div class="member-name">${safe(profile.name)} 님</div>
          <div>${safe(profile.email)}</div>
          <div class="point-number">
            ${Number(profile.points || 0).toLocaleString("ko-KR")} P
          </div>
          <small>사용 가능 포인트</small>
        </aside>

        <div class="mypage-content">
          <div class="mypage-tabs">
            <button class="${tab === "orders" ? "active" : ""}"
              data-tab="orders">주문 내역</button>
            <button class="${tab === "grade" ? "active" : ""}"
              data-tab="grade">회원 등급 안내</button>
          </div>

          <h3>${tab === "orders" ? "ORDER HISTORY" : "MEMBERSHIP BENEFIT"}</h3>
          ${content}
        </div>
      </div>
    </section>
  `;
}

/* ==========================================
   화면 이동
========================================== */

function navigate(view, data) {
  currentView = view;

  document.querySelectorAll(".nav-link").forEach(link =>
    link.classList.toggle("active", link.dataset.view === view)
  );

  if (view !== "home") clearInterval(slideTimer);

  if (view === "home") {
    renderHome();
  } else if (view === "products") {
    activeCategory = "ALL";
    searchKeyword = "";
    renderProducts();
  } else if (view === "detail") {
    renderDetail(data);
  } else if (view === "cart") {
    renderCart();
  } else if (view === "login" || view === "signup") {
    renderAuth(view);
  } else if (view === "mypage") {
    renderMypage();
  }

  $("#mainNav").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
  app.focus({ preventScroll: true });
  updateHeader();
}

/* ==========================================
   체험 주문
========================================== */

function checkout() {
  if (!currentSession?.user) {
    toast("주문하려면 먼저 로그인해 주세요.");
    return navigate("login");
  }

  if (!cart.length) {
    return toast("장바구니가 비어 있습니다.");
  }

  const items = cart.map(item => {
    const product = PRODUCTS.find(
      p => String(p.id) === String(item.productId)
    );

    if (!product) return null;

    return {
      productId: product.id,
      name: product.name,
      price: product.price,
      qty: item.qty
    };
  }).filter(Boolean);

  if (!items.length) {
    return toast("주문할 상품을 찾을 수 없습니다.");
  }

  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.qty,
    0
  );

  const total = subtotal + (subtotal >= 50000 ? 0 : 3000);

  const order = {
    id: "PR" + Date.now().toString().slice(-10),
    userId: currentSession.user.id,
    date: new Date().toISOString(),
    items,
    total,
    status: "체험 주문 완료"
  };

  orders.push(order);
  cart = [];

  saveStorage();
  updateHeader();

  app.innerHTML = `
    <section class="page-shell">
      <div class="order-complete">
        <div class="check">✓</div>
        <h2>주문이 완료되었습니다.</h2>
        <p>PRIDE를 이용해 주셔서 감사합니다.</p>
        <div class="notice">
          주문번호 <b>${order.id}</b><br>
          주문 금액 ${money(total)}<br>
          <small>실제 결제는 진행되지 않은 체험 주문입니다.</small>
        </div>
        <button class="primary-button"
          style="padding:13px 25px"
          data-view="mypage">주문 내역 확인</button>
      </div>
    </section>
  `;

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ==========================================
   클릭 이벤트
========================================== */

document.addEventListener("click", event => {
  const view = event.target.closest("[data-view]");

  if (view) {
    event.preventDefault();
    navigate(view.dataset.view);
    return;
  }

  const category = event.target.closest("[data-category]");

  if (category) {
    activeCategory = category.dataset.category;
    searchKeyword = "";
    navigate("products");
    activeCategory = category.dataset.category;
    renderProducts();
    return;
  }

  const product = event.target.closest("[data-product]");

  if (product) {
    navigate("detail", product.dataset.product);
    return;
  }

  const filter = event.target.closest("[data-filter]");

  if (filter) {
    activeCategory = filter.dataset.filter;

    document.querySelectorAll("[data-filter]").forEach(button =>
      button.classList.toggle("active", button === filter)
    );

    drawProductList();
    return;
  }

  const slide = event.target.closest("[data-slide]");

  if (slide) {
    showSlide(Number(slide.dataset.slide));
    return;
  }

  const tab = event.target.closest("[data-tab]");

  if (tab) {
    renderMypage(tab.dataset.tab);
    return;
  }

  const action = event.target.closest("[data-action]");

  if (!action) return;

  const id = action.dataset.id;

  switch (action.dataset.action) {
    case "slide-prev":
      showSlide(slideIndex - 1);
      break;

    case "slide-next":
      showSlide(slideIndex + 1);
      break;

    case "logout":
      signOut();
      break;

    case "search":
      searchKeyword = $("#productSearch").value.trim();
      drawProductList();
      break;

    case "detail-minus":
      detailQty = Math.max(1, detailQty - 1);
      $("#detailQty").textContent = detailQty;
      break;

    case "detail-plus": {
      const product = PRODUCTS.find(
        p => String(p.id) === String(currentDetailId)
      );

      detailQty = Math.min(
        Number(product?.stock || 0),
        detailQty + 1
      );

      $("#detailQty").textContent = detailQty;
      break;
    }

    case "add-cart":
      addToCart(id, detailQty);
      break;

    case "buy-now":
      addToCart(id, detailQty);
      navigate("cart");
      break;

    case "cart-minus":
      changeCart(id, -1);
      break;

    case "cart-plus":
      changeCart(id, 1);
      break;

    case "cart-delete":
      cart = cart.filter(
        item => String(item.productId) !== String(id)
      );
      saveStorage();
      renderCart();
      updateHeader();
      toast("상품을 삭제했습니다.");
      break;

    case "checkout":
      checkout();
      break;
  }
});

/* ==========================================
   로그인 / 회원가입 제출
========================================== */

document.addEventListener("submit", async event => {
  if (event.target.id !== "authForm") return;

  event.preventDefault();

  const form = new FormData(event.target);
  const isSignup = Boolean(event.target.querySelector("#name"));

  const submitButton = event.target.querySelector(
    'button[type="submit"]'
  );

  if (submitButton) submitButton.disabled = true;

  try {
    if (isSignup) {
      await signUp(form);
    } else {
      await signIn(form);
    }
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

/* ==========================================
   검색 및 정렬
========================================== */

document.addEventListener("input", event => {
  if (event.target.id === "productSearch") {
    searchKeyword = event.target.value.trim();
    drawProductList();
  }
});

document.addEventListener("change", event => {
  if (event.target.id === "sortProducts") {
    drawProductList();
  }
});

/* ==========================================
   기존 공통 이벤트
========================================== */

$("#menuToggle").addEventListener("click", () =>
  $("#mainNav").classList.toggle("open")
);

$("#toTop").addEventListener("click", () =>
  window.scrollTo({ top: 0, behavior: "smooth" })
);

$("#modalClose").addEventListener("click", () =>
  $("#modalBackdrop").hidden = true
);

$("#modalBackdrop").addEventListener("click", event => {
  if (event.target.id === "modalBackdrop") {
    event.currentTarget.hidden = true;
  }
});

/* ==========================================
   최초 실행
========================================== */

renderHome();
updateHeader();
loadProducts();
initializeAuth();
