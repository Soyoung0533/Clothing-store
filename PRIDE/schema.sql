-- PRIDE 의류 쇼핑몰 데이터베이스 설계 (MySQL 8.0 / utf8mb4)
-- 옵션(색상·사이즈)은 상품의 판매 가능한 조합이므로 PRODUCT_VARIANTS에 저장합니다.
-- ORDER_ITEMS에는 고객이 실제 선택한 variant_id와 주문 당시 상품명/옵션/가격을 기록합니다.

CREATE DATABASE IF NOT EXISTS pride_shop
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE pride_shop;

CREATE TABLE MEMBERS (
  member_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  points INT NOT NULL DEFAULT 3000,
  total_spent BIGINT NOT NULL DEFAULT 0,
  grade_code VARCHAR(20) NOT NULL DEFAULT 'WELCOME',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE PRODUCTS (
  product_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_name VARCHAR(150) NOT NULL,
  category VARCHAR(30) NOT NULL,
  price INT NOT NULL,
  description TEXT,
  image_path VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 한 상품에 여러 색상·사이즈 조합이 존재하며, 재고는 조합별로 관리합니다.
CREATE TABLE PRODUCT_VARIANTS (
  variant_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT NOT NULL,
  sku VARCHAR(50) NOT NULL UNIQUE,
  color VARCHAR(40) NOT NULL,
  size VARCHAR(20) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_variant_product FOREIGN KEY (product_id)
    REFERENCES PRODUCTS(product_id),
  CONSTRAINT uq_product_color_size UNIQUE (product_id, color, size),
  CONSTRAINT chk_variant_stock CHECK (stock >= 0)
);

CREATE TABLE ORDERS (
  order_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  member_id BIGINT NOT NULL,
  ordered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_amount INT NOT NULL,
  order_status VARCHAR(30) NOT NULL DEFAULT '주문완료',
  CONSTRAINT fk_order_member FOREIGN KEY (member_id)
    REFERENCES MEMBERS(member_id)
);

-- 주문 상세 한 행은 구매한 상품 옵션(색상+사이즈) 한 종류를 의미합니다.
-- 주문 당시 정보 보존을 위해 상품명/색상/사이즈/가격을 스냅샷으로 함께 저장합니다.
CREATE TABLE ORDER_ITEMS (
  order_item_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  variant_id BIGINT NOT NULL,
  product_name_snapshot VARCHAR(150) NOT NULL,
  color_snapshot VARCHAR(40) NOT NULL,
  size_snapshot VARCHAR(20) NOT NULL,
  unit_price INT NOT NULL,
  quantity INT NOT NULL,
  line_amount INT NOT NULL,
  CONSTRAINT fk_item_order FOREIGN KEY (order_id)
    REFERENCES ORDERS(order_id),
  CONSTRAINT fk_item_variant FOREIGN KEY (variant_id)
    REFERENCES PRODUCT_VARIANTS(variant_id),
  CONSTRAINT chk_order_item_quantity CHECK (quantity > 0)
);

CREATE TABLE MEMBER_GRADES (
  grade_code VARCHAR(20) PRIMARY KEY,
  min_total_spent BIGINT NOT NULL,
  point_rate DECIMAL(4,3) NOT NULL
);

INSERT INTO MEMBER_GRADES (grade_code, min_total_spent, point_rate) VALUES
('WELCOME', 0, 0.010),
('SILVER', 100000, 0.030),
('GOLD', 300000, 0.050),
('PRIDE', 700000, 0.070);

-- 수업 시연용 상품 8개와 옵션 데이터
INSERT INTO PRODUCTS (product_id, product_name, category, price, description, image_path) VALUES
(1, '골드 버튼 트위드 자켓', 'OUTERWEAR', 199000, '섬세한 트위드 텍스처와 은은한 골드 버튼이 돋보이는 클래식 자켓입니다.', 'img/products/outer1.jpg'),
(2, '클래식 플레어 원피스', 'DRESSES', 179000, '허리선을 자연스럽게 잡아주는 실루엣으로 우아한 분위기를 완성합니다.', 'img/products/dress1.jpg'),
(3, '실크 블라우스', 'BLOUSES', 129000, '부드러운 광택과 가벼운 착용감이 매력적인 데일리 블라우스입니다.', 'img/products/blouse1.jpg'),
(4, '프리미엄 롱 코트', 'OUTERWEAR', 299000, '정제된 테일러링과 여유로운 핏으로 오래도록 입기 좋은 코트입니다.', 'img/products/outer2.jpg'),
(5, '새틴 슬립 원피스', 'DRESSES', 159000, '차분하게 흐르는 새틴 소재가 특별한 날의 룩을 완성해 줍니다.', 'img/products/dress2.jpg'),
(6, '타이 디테일 블라우스', 'BLOUSES', 119000, '목선을 따라 자연스럽게 떨어지는 타이 디테일이 포인트입니다.', 'img/products/blouse2.jpg'),
(7, '모던 니트 셋업', 'SETS', 189000, '편안한 니트 소재와 단정한 디자인으로 활용도가 높은 셋업입니다.', 'img/products/etc1.jpg'),
(8, '골드 포인트 스커트', 'SETS', 109000, '절제된 라인과 작은 골드 장식으로 세련된 포인트를 더했습니다.', 'img/products/etc2.jpg');

INSERT INTO PRODUCT_VARIANTS (variant_id, product_id, sku, color, size, stock) VALUES
(1,1,'PR-001-IV-S','아이보리','S',5),(2,1,'PR-001-IV-M','아이보리','M',6),(3,1,'PR-001-IV-L','아이보리','L',3),(4,1,'PR-001-NV-S','네이비','S',2),(5,1,'PR-001-NV-M','네이비','M',2),
(6,2,'PR-002-BK-S','블랙','S',3),(7,2,'PR-002-BK-M','블랙','M',4),(8,2,'PR-002-BK-L','블랙','L',2),(9,2,'PR-002-BG-M','베이지','M',3),
(10,3,'PR-003-WH-S','화이트','S',8),(11,3,'PR-003-WH-M','화이트','M',7),(12,3,'PR-003-WH-L','화이트','L',4),(13,3,'PR-003-BG-M','베이지','M',6),
(14,4,'PR-004-BG-S','베이지','S',2),(15,4,'PR-004-BG-M','베이지','M',3),(16,4,'PR-004-BG-L','베이지','L',1),(17,4,'PR-004-BK-M','블랙','M',2),
(18,5,'PR-005-CH-S','샴페인','S',4),(19,5,'PR-005-CH-M','샴페인','M',5),(20,5,'PR-005-CH-L','샴페인','L',2),(21,5,'PR-005-BK-M','블랙','M',3),
(22,6,'PR-006-WH-S','화이트','S',5),(23,6,'PR-006-WH-M','화이트','M',6),(24,6,'PR-006-BK-M','블랙','M',4),(25,6,'PR-006-BK-L','블랙','L',5),
(26,7,'PR-007-CR-S','크림','S',2),(27,7,'PR-007-CR-M','크림','M',3),(28,7,'PR-007-CR-L','크림','L',2),(29,7,'PR-007-GY-M','그레이','M',3),
(30,8,'PR-008-BK-S','블랙','S',4),(31,8,'PR-008-BK-M','블랙','M',5),(32,8,'PR-008-BK-L','블랙','L',3),(33,8,'PR-008-BG-M','베이지','M',4);
