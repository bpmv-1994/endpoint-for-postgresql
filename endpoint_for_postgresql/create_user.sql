CREATE ROLE vadim WITH LOGIN PASSWORD '1234'; -- Создание нового пользователя
ALTER ROLE vadim WITH SUPERUSER;              -- Назначение прав суперюзера

CREATE DATABASE warehouse;               -- Создание базы данных "Склад"
ALTER DATABASE warehouse OWNER TO vadim; -- Создание прав на использование пользователю(role) vadim.

-- sudo emacs /etc/postgresql/16/main/pg_hba.conf & -- Изменение метода аутентификации.
-- Заменяем сроку: local   all             all                                     peer
-- на              local   all             all                                     md5
-- И подключаемся к базе данных: psql -U vadim -d warehouse

CREATE TABLE products ( -- Создание таблицы товара.
    id SERIAL PRIMARY KEY,
    article VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    quantity_in_shop INT NOT NULL,
    quantity_on_shelf INT NOT NULL,
    quantity_in_order INT NOT NULL,
    shop_id INT NOT NULL
);

-- UPDATE products SET quantity_on_shelf = 50 WHERE article = '4620750540044';
-- UPDATE products SET quantity_in_order = 44 WHERE article = '4620750540044';
CREATE TABLE history (                                                     
  id SERIAL PRIMARY KEY,
  shop_id INT,
  article VARCHAR(255),
  date TIMESTAMP,
  action VARCHAR(255),
  details TEXT
);
