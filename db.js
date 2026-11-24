
/* 상품 정보는 Supabase public.shop_products에서 불러옵니다. */
let PRODUCTS = [];
let CATEGORIES = ["ALL"];
let currentView = "home";
let currentDetailId = null;

const MEMBER_GRADES = [
  { name: "WELCOME", minPoint: 0, rate: 0.01 },
  { name: "SILVER", minPoint: 100000, rate: 0.03 },
  { name: "GOLD", minPoint: 300000, rate: 0.05 },
  { name: "PRIDE", minPoint: 700000, rate: 0.07 }
];

const STORAGE = {
  users: "pride_users",
  current: "pride_current_user",
  cart: "pride_cart",
  orders: "pride_orders"
};

const money = value =>
  new Intl.NumberFormat("ko-KR").format(value) + "원";

const read = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key, value) =>
  localStorage.setItem(key, JSON.stringify(value));

let users = read(STORAGE.users, []);
let currentUserId = read(STORAGE.current, null);
let cart = read(STORAGE.cart, []);
let orders = read(STORAGE.orders, []);

let activeCategory = "ALL";
let searchKeyword = "";
let slideIndex = 0;
let slideTimer = null;
let toastTimer = null;
let detailQty = 1;
let mypageTab = "orders";

const app = document.getElementById("app");
const $ = selector => document.querySelector(selector);

const currentUser = () =>
  users.find(user => user.id === currentUserId) || null;

const getGrade = user =>
  [...MEMBER_GRADES].reverse().find(
    grade => user && user.totalSpent >= grade.minPoint
  ) || MEMBER_GRADES[0];

const safe = value =>
  String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));

/* Supabase에서 활성 상품 조회 */
async function loadProducts() {
  try {
    const { data, error } = await db
      .from("shop_products")
      .select("id, name, category, price, stock, image_url, is_active")
      .eq("is_active", true)
      .order("id", { ascending: true });

    if (error) throw error;

    PRODUCTS = (data || []).map(product => ({
      ...product,
      image: product.image_url
    }));

    CATEGORIES = [
      "ALL",
      ...new Set(
        PRODUCTS.map(product => product.category).filter(Boolean)
      )
    ];

    renderCategoryNavigation();

    if (currentView === "home") renderHome();
    else if (currentView === "products") renderProducts();
    else if (currentView === "detail") renderDetail(currentDetailId);
    else if (currentView === "cart") renderCart();

  } catch (error) {
    console.error("상품 목록을 불러오지 못했습니다:", error.message);
    toast("상품 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}

function persist() {
  write(STORAGE.users, users);
  write(STORAGE.current, currentUserId);
  write(STORAGE.cart, cart);
  write(STORAGE.orders, orders);
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(
    () => el.classList.remove("show"),
    2300
  );
}

function updateHeader() {
  const user = currentUser();

  $("#accountLinks").innerHTML = user
    ? `<span>${safe(user.name)}님</span> <span>|</span> <button data-action="logout">로그아웃</button>`
    : `<button data-view="login">로그인</button><span>|</span><button data-view="signup">회원가입</button>`;

  $("#cartCount").textContent = cart.reduce(
    (sum, item) => sum + item.qty,
    0
  );
}

/* 메인 배너 */
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

  $("#heroSlides").innerHTML = slides.map((slide, i) =>
    `<article class="hero-slide ${i === 0 ? "active" : ""}" style="background-image:url('${slide.image}')">
      <div class="hero-copy">
        <span class="eyebrow">${slide.eyebrow}</span>
        <h1>${slide.title}</h1>
        <p>${slide.text}</p>
        <button data-view="products">SHOP THE COLLECTION　→</button>
      </div>
    </article>`
  ).join("");

  $("#slideDots").innerHTML = slides.map((_, i) =>
    `<button class="${i === 0 ? "active" : ""}" data-slide="${i}" aria-label="${i + 1}번 배너"></button>`
  ).join("");

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

/* 상품 카드 */
function productCard(product) {
  return `
    <article class="product-card"
      data-product="${product.id}"
      tabindex="0"
      aria-label="${safe(product.name)} 상세 보기">
      <div class="product-image">
        <img src="${safe(product.image_url)}"
          alt="${safe(product.name)}"
          loading="lazy">
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

/* DB에서 읽은 분류로 상단 메뉴 생성 */
function renderCategoryNavigation() {
  const nav = $("#categoryNavItems");

  if (!nav) return;

  nav.innerHTML = CATEGORIES.slice(1).map(category =>
    `<button class="nav-link" data-category="${safe(category)}">${safe(category)}</button>`
  ).join("");
}

/* 메인 화면 */
function renderHome() {
  app.innerHTML = `
    <section class="hero" id="hero" aria-label="PRIDE 메인 배너">
      <div class="hero-slides" id="heroSlides"></div>
      <button class="slide-arrow prev" id="prevSlide"
        data-action="slide-prev" aria-label="이전 배너">‹</button>
      <button class="slide-arrow next" id="nextSlide"
        data-action="slide-next" aria-label="다음 배너">›</button>
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
    const firstProduct = PRODUCTS.find(
      product => product.category === category
    );

    return `
      <article class="category-card" data-category="${safe(category)}">
        <img src="${safe(firstProduct?.image_url || "")}"
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

/* 전체 상품 화면 */
function renderProducts() {
  app.innerHTML = `
    <section class="page-shell">
      <div class="page-title">
        <span>PRIDE COLLECTION</span>
        <h1>SHOP ALL</h1>
        <p>당신의 스타일을 완성할 아이템</p>
      </div>

      <div class="toolbar">
        <div class="filter-row">
          ${CATEGORIES.map(c =>
            `<button class="filter-chip ${activeCategory === c ? "active" : ""}"
              data-filter="${c}">${c}</button>`
          ).join("")}
        </div>

        <div class="search-box">
          <input id="productSearch" type="search"
            placeholder="상품명을 검색하세요"
            value="${safe(searchKeyword)}"
            aria-label="상품 검색">
          <button data-action="search">⌕</button>
        </div>
      </div>

      <div class="toolbar">
        <span id="resultCount" class="product-desc"></span>
        <select class="sort-select" id="sortProducts" aria-label="상품 정렬">
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

/* DB에서 가져온 상품으로 분류 및 검색 */
function drawProductList() {
  let list = PRODUCTS.filter(p =>
    (activeCategory === "ALL" || p.category === activeCategory) &&
    p.name.toLowerCase().includes(searchKeyword.toLowerCase())
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

/* 상품 상세 */
function renderDetail(id) {
  const p = PRODUCTS.find(
    item => String(item.id) === String(id)
  );

  if (!p) return navigate("products");

  detailQty = 1;
  currentDetailId = p.id;

  app.innerHTML = `
    <section class="page-shell">
      <div class="page-title">
        <span>PRIDE COLLECTION</span>
        <h1>PRODUCT DETAIL</h1>
      </div>

      <div class="detail-layout">
        <div class="detail-image">
          <img src="${safe(p.image_url)}" alt="${safe(p.name)}">
        </div>

        <div class="detail-copy">
          <span class="product-category">${safe(p.category)}</span>
          <h1>${safe(p.name)}</h1>
          <div class="detail-price">${money(p.price)}</div>

          <div class="detail-description">
            PRIDE의 감각적인 디자인과 섬세한 디테일로 완성한 상품입니다.
            <br><br>
            당신만의 분위기를 완성하는 선택을 만나보세요.
          </div>

          <div class="detail-row">
            <span>배송</span>
            <span>5만원 이상 무료배송</span>
          </div>

          <div class="detail-row">
            <span>적립</span>
            <span>회원 등급별 1~7% 적립</span>
          </div>

          <div class="detail-row">
            <span>재고</span>
            <span>${Number(p.stock) || 0}개</span>
          </div>

          <div class="qty-control">
            <button data-action="detail-minus">−</button>
            <span id="detailQty">1</span>
            <button data-action="detail-plus">＋</button>
          </div>

          <div class="action-row">
            <button class="secondary-button"
              data-action="add-cart" data-id="${p.id}">
              장바구니 담기
            </button>
            <button class="primary-button"
              data-action="buy-now" data-id="${p.id}">
              바로 구매
            </button>
          </div>
        </div>
      </div>
    </section>
  `;
}

/* 장바구니 */
function renderCart() {
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
                    data-id="${item.productId}"
                    aria-label="상품 삭제">×</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <div class="cart-summary">
          <div class="summary-line">
            <span>상품 금액</span>
            <b>${money(subtotal)}</b>
          </div>

          <div class="summary-line">
            <span>배송비</span>
            <b>${subtotal >= 50000 ? "무료" : money(subtotal ? 3000 : 0)}</b>
          </div>

          <div class="summary-line summary-total">
            <span>총 결제 예정 금액</span>
            <b>${money(subtotal + (subtotal >= 50000 || !subtotal ? 0 : 3000))}</b>
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

/* 로그인 및 회원가입 */
function renderAuth(mode) {
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
            <input id="name" name="name" required
              maxlength="20" placeholder="이름을 입력하세요">
          </div>
        ` : ""}

        <div class="form-field">
          <label for="email">이메일</label>
          <input id="email" name="email" type="email"
            required placeholder="example@email.com">
        </div>

        <div class="form-field">
          <label for="password">비밀번호</label>
          <input id="password" name="password" type="password"
            required minlength="4"
            placeholder="${signup ? "4자 이상 입력하세요" : "비밀번호를 입력하세요"}">
        </div>

        ${signup ? `
          <div class="notice">
            가입 즉시 3,000P가 지급됩니다.
            (체험용 계정 정보는 현재 브라우저에 저장됩니다.)
          </div>
        ` : ""}

        <button class="primary-button" type="submit">
          ${signup ? "3,000P 받고 가입하기" : "로그인"}
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

/* 마이페이지 */
function renderMypage(tab = mypageTab) {
  const user = currentUser();

  if (!user) return navigate("login");

  mypageTab = tab;
  const grade = getGrade(user);

  const content = tab === "orders"
    ? (
      orders.filter(o => o.userId === user.id).length
        ? orders.filter(o => o.userId === user.id)
          .slice().reverse()
          .map(o => `
            <div class="order-item">
              <div>
                <b>주문번호 ${safe(o.id)}</b>
                <small>
                  ${new Date(o.date).toLocaleString("ko-KR")} ·
                  ${o.items.map(i =>
                    i.color || i.size
                      ? `${safe(i.name)} (${safe(i.color || "")} / ${safe(i.size || "")})`
                      : safe(i.name)
                  ).join(", ")}
                </small>
              </div>
              <div>
                <b>${money(o.total)}</b>
                <small class="order-status">${safe(o.status)}</small>
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
        회원 등급은 누적 구매 금액을 기준으로 적용됩니다.
        등급별 적립률은 다음 주문부터 반영됩니다.
      </div>
      ${MEMBER_GRADES.map(g => `
        <div class="order-item">
          <div>
            <b>${g.name}</b>
            <small>누적 구매 ${money(g.minPoint)} 이상</small>
          </div>
          <b>${Math.round(g.rate * 100)}% 적립</b>
        </div>
      `).join("")}
    `;

  app.innerHTML = `
    <section class="page-shell">
      <div class="page-title">
        <span>YOUR PRIDE</span>
        <h1>MY PAGE</h1>
      </div>

      <div class="mypage-grid">
        <aside class="member-card">
          <span class="grade">${grade.name} MEMBER</span>
          <div class="member-name">${safe(user.name)} 님</div>
          <div>${safe(user.email)}</div>
          <div class="point-number">
            ${user.points.toLocaleString("ko-KR")} P
          </div>
          <small>사용 가능 포인트</small>
          <div style="margin-top:20px;font-size:11px;color:#c8d0dc">
            누적 구매 ${money(user.totalSpent)}<br>
            현재 적립률 ${Math.round(grade.rate * 100)}%
          </div>
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

/* 화면 이동 */
function navigate(view, data) {
  currentView = view;

  document.querySelectorAll(".nav-link").forEach(link =>
    link.classList.toggle(
      "active",
      link.dataset.view === view ||
      (view === "products" && link.dataset.category === activeCategory)
    )
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

/* 장바구니에 DB 상품 id 저장 */
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

  if (qty + (found?.qty || 0) > Number(product.stock || 0)) {
    return toast("상품 재고가 부족합니다.");
  }

  if (found) {
    found.qty += qty;
  } else {
    cart.push({
      productId: product.id,
      qty
    });
  }

  persist();
  updateHeader();
  toast("상품을 장바구니에 담았습니다.");
}

/* 장바구니 수량 변경 */
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
    Math.min(Number(product.stock || 0), item.qty + delta)
  );

  persist();
  renderCart();
  updateHeader();
}

/* 체험 주문 처리 - DB 재고는 변경하지 않음 */
function checkout() {
  const user = currentUser();

  if (!user) {
    toast("주문하려면 먼저 로그인해 주세요.");
    navigate("login");
    return;
  }

  if (!cart.length) {
    return toast("장바구니가 비어 있습니다.");
  }

  const items = cart.map(item => {
    const product = PRODUCTS.find(
      p => String(p.id) === String(item.productId)
    );

    return product
      ? {
          productId: product.id,
          name: product.name,
          category: product.category,
          price: product.price,
          qty: item.qty
        }
      : null;
  }).filter(Boolean);

  if (!items.length) {
    return toast("장바구니 상품을 찾을 수 없습니다.");
  }

  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.qty,
    0
  );

  const shipping = subtotal >= 50000 ? 0 : 3000;
  const total = subtotal + shipping;
  const grade = getGrade(user);
  const earned = Math.floor(total * grade.rate);

  const order = {
    id: "PR" + Date.now().toString().slice(-10),
    userId: user.id,
    date: new Date().toISOString(),
    items,
    total,
    status: "체험 주문 완료",
    earnedPoints: earned
  };

  orders.push(order);
  user.points += earned;
  user.totalSpent += total;
  cart = [];

  persist();
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
          적립 포인트 <b>${earned.toLocaleString("ko-KR")}P</b><br>
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

/* 클릭 이벤트 */
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

    document.querySelectorAll("[data-filter]").forEach(b =>
      b.classList.toggle("active", b === filter)
    );

    drawProductList();
    return;
  }

  const slide = event.target.closest("[data-slide]");

  if (slide) {
    showSlide(Number(slide.dataset.slide));
    clearInterval(slideTimer);
    slideTimer = setInterval(() => showSlide(slideIndex + 1), 6000);
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
      clearInterval(slideTimer);
      slideTimer = setInterval(() => showSlide(slideIndex + 1), 6000);
      break;

    case "slide-next":
      showSlide(slideIndex + 1);
      clearInterval(slideTimer);
      slideTimer = setInterval(() => showSlide(slideIndex + 1), 6000);
      break;

    case "logout":
      currentUserId = null;
      persist();
      updateHeader();
      toast("로그아웃되었습니다.");
      navigate("home");
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

      persist();
      renderCart();
      updateHeader();
      toast("상품을 삭제했습니다.");
      break;

    case "checkout":
      checkout();
      break;
  }
});

/* 회원가입 및 로그인 이벤트 */
document.addEventListener("submit", event => {
  if (event.target.id !== "authForm") return;

  event.preventDefault();

  const form = new FormData(event.target);
  const email = String(form.get("email")).trim().toLowerCase();
  const password = String(form.get("password"));

  if (event.target.querySelector("#name")) {
    const name = String(form.get("name")).trim();

    if (users.some(u => u.email === email)) {
      return toast("이미 가입된 이메일입니다.");
    }

    const user = {
      id: "U" + Date.now(),
      name,
      email,
      password,
      points: 3000,
      totalSpent: 0,
      createdAt: new Date().toISOString()
    };

    users.push(user);
    currentUserId = user.id;

    persist();
    updateHeader();
    toast("가입 완료! 3,000P가 지급되었습니다.");
    navigate("mypage");

  } else {
    const user = users.find(
      u => u.email === email && u.password === password
    );

    if (!user) {
      return toast("이메일 또는 비밀번호를 확인해 주세요.");
    }

    currentUserId = user.id;

    persist();
    updateHeader();
    toast("로그인되었습니다.");
    navigate("mypage");
  }
});

/* 검색 입력 이벤트 */
document.addEventListener("input", event => {
  if (event.target.id === "productSearch") {
    searchKeyword = event.target.value.trim();
    drawProductList();
  }
});

/* 상품 정렬 */
document.addEventListener("change", event => {
  if (event.target.id === "sortProducts") {
    drawProductList();
  }
});

/* 기존 기타 이벤트 */
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

/* 초기 화면 표시 및 Supabase 상품 조회 */
renderHome();
updateHeader();
loadProducts();
