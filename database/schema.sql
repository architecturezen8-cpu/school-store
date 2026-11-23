-- =====================================================================
--  ST. THOMAS' COLLEGE MATALE — THOMIAN STORE
--  Fresh schema. Run this whole file ONCE — it drops any old tables
--  first, then builds the new store structure.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. CLEAR OUT THE OLD STRUCTURE
--    (order matters because of foreign keys)
-- ---------------------------------------------------------------------
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS product_options;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS cart;
DROP TABLE IF EXISTS wishlist;
DROP TABLE IF EXISTS site_settings;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- 2. CATEGORIES  — the 5 things the store sells
-- ---------------------------------------------------------------------
CREATE TABLE categories (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug        VARCHAR(80)  NOT NULL UNIQUE,
  title       VARCHAR(120) NOT NULL,
  description TEXT         NULL,
  image_url   VARCHAR(500) NULL,
  sort_order  INT UNSIGNED NOT NULL DEFAULT 0,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO categories (slug, title, description, sort_order) VALUES
  ('badges',              'Badges',              'Prefect, house & society badges.',                        1),
  ('uniforms',            'Uniforms',            'Regulation shirts, ties and blazers.',                    2),
  ('event-clothings',     'Event Clothings',     'Hoodies, scarves and caps for college occasions.',        3),
  ('exam-writing-papers', 'Exam Writing Papers', 'Answer booklets, writing pads and pens.',                 4),
  ('batch-shirts',        'Batch Shirts',        'Class batch tees, polos and class shirts.',               5);

-- ---------------------------------------------------------------------
-- 3. PRODUCTS
-- ---------------------------------------------------------------------
CREATE TABLE products (
  id           INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  category_id  INT UNSIGNED  NOT NULL,
  slug         VARCHAR(120)  NOT NULL UNIQUE,
  name         VARCHAR(200)  NOT NULL,
  description  TEXT          NULL,
  price        DECIMAL(10,2) NOT NULL DEFAULT 0,
  compare_at   DECIMAL(10,2) NULL,               -- original price, for discounts
  image_url    VARCHAR(500)  NULL,
  tag          VARCHAR(40)   NULL,               -- Official / New / Limited / Best Seller
  details      TEXT          NULL,               -- one line per bullet, "\n" separated
  stock        INT UNSIGNED  NOT NULL DEFAULT 0,
  rating       DECIMAL(2,1)  NOT NULL DEFAULT 0,
  review_count INT UNSIGNED  NOT NULL DEFAULT 0,
  is_active    TINYINT(1)    NOT NULL DEFAULT 1,
  is_featured  TINYINT(1)    NOT NULL DEFAULT 0,
  sort_order   INT UNSIGNED  NOT NULL DEFAULT 0,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_category
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  INDEX idx_product_category (category_id),
  INDEX idx_product_featured (is_featured)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Optional size / colour choices per product
CREATE TABLE product_options (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id  INT UNSIGNED NOT NULL,
  label       VARCHAR(60)  NOT NULL,              -- e.g. "Size"
  value       VARCHAR(60)  NOT NULL,              -- e.g. "L"
  sort_order  INT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT fk_option_product
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_option_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 4. CUSTOMERS & ORDERS
-- ---------------------------------------------------------------------
CREATE TABLE customers (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email        VARCHAR(180) NOT NULL UNIQUE,
  full_name    VARCHAR(160) NOT NULL,
  phone        VARCHAR(40)  NULL,
  address_line VARCHAR(255) NULL,
  city         VARCHAR(100) NULL,
  postal_code  VARCHAR(20)  NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE orders (
  id            INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  order_number  VARCHAR(30)   NOT NULL UNIQUE,    -- shown to the customer, e.g. STC-000123
  customer_id   INT UNSIGNED  NOT NULL,
  subtotal      DECIMAL(10,2) NOT NULL DEFAULT 0,
  shipping      DECIMAL(10,2) NOT NULL DEFAULT 0,
  total         DECIMAL(10,2) NOT NULL DEFAULT 0,
  status        ENUM('pending','confirmed','packed','shipped','delivered','cancelled')
                              NOT NULL DEFAULT 'pending',
  payment_method ENUM('cash_on_delivery','bank_transfer','online') NOT NULL DEFAULT 'cash_on_delivery',
  note          TEXT          NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  INDEX idx_order_status (status),
  INDEX idx_order_number (order_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_items (
  id          INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  order_id    INT UNSIGNED  NOT NULL,
  product_id  INT UNSIGNED  NOT NULL,
  variant     VARCHAR(60)   NULL,                 -- chosen size / colour
  quantity    INT UNSIGNED  NOT NULL DEFAULT 1,
  unit_price  DECIMAL(10,2) NOT NULL,
  line_total  DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_item_order
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_item_product
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  INDEX idx_item_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- 5. REVIEWS
-- ---------------------------------------------------------------------
CREATE TABLE reviews (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NULL,
  author     VARCHAR(160) NOT NULL,
  role       VARCHAR(120) NULL,                 -- e.g. "Old Thomian · Class of 2011"
  body       TEXT         NOT NULL,
  rating     TINYINT UNSIGNED NOT NULL DEFAULT 5,
  is_visible TINYINT(1)   NOT NULL DEFAULT 1,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_review_product
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_review_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
--  END OF SCHEMA
--  Suggested API read endpoints for the front end:
--    GET /categories                -> all active categories
--    GET /products                  -> all active products (join category)
--    GET /products?category=badges  -> filtered by category slug
--    GET /products/:slug            -> single product + options + details
--    POST /orders                   -> { customer, items:[{slug,variant,qty}] }
-- =====================================================================
