const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const cors = require('cors');

const app = express();
const PORT = 9090;

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
    user: 'vadim',
    host: 'localhost',
    database: 'warehouse',
    password: '1234',
    port: 5432
});

// Функция для записи в таблицу history
async function logAction(shopId, article, action, details) {
    const client = await pool.connect();
    try {
        await client.query(
            'INSERT INTO history (shop_id, article, date, action, details) VALUES ($1, $2, NOW(), $3, $4)',
            [shopId, article, action, details]
        );
        console.log('История успешно записана');
    } catch (err) {
        console.error('Ошибка записи действия в историю:', err);
    } finally {
        client.release();
    }
};

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/products/issue', async (req, res) => {
    const { article, shopId, quantity } = req.body;

    try {
        const result = await pool.query(
            'SELECT * FROM products WHERE article = $1 AND shop_id = $2',
            [article, shopId]
        );

        if (result.rowCount === 0) {
            console.log('Товар не найден');
            return res.status(404).json({ error: 'Товар не найден' });
        }

        const product = result.rows[0];
        const currentQuantity = product.quantity_in_shop;

        if (currentQuantity < quantity) {
            console.log('Недостаточно товара на складе');
            return res.status(400).json({ error: 'Недостаточно товара на складе' });
        }

        const updatedResult = await pool.query(
            'UPDATE products SET quantity_in_shop = quantity_in_shop - $1 WHERE article = $2 AND shop_id = $3 RETURNING *',
            [quantity, article, shopId]
        );

        const updatedProduct = updatedResult.rows[0];

        await logAction(shopId, article, "Выдача товара", `Выдано ${quantity} штук товара`);

        res.setHeader('Content-Type', 'application/json');
        res.status(200).json({
            message: `Выдано ${quantity} штук товара ${updatedProduct.name}`,
            product: updatedProduct.name,
            issuedQuantity: quantity
        });
    } catch (err) {
        console.error('Ошибка выполнения запроса:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/history', async (req, res) => {
    const { shopId, article, dateFrom, dateTo } = req.query;

    try {
        let query = 'SELECT * FROM history WHERE 1=1';
        let queryParams = [];
        if (shopId) {
            queryParams.push(shopId);
            query += ` AND shop_id = $${queryParams.length}`;
        }
        if (article) {
            queryParams.push(article);
            query += ` AND article = $${queryParams.length}`;
        }
        if (dateFrom) {
            queryParams.push(dateFrom);
            query += ` AND date::date >= $${queryParams.length}`;
        }
        if (dateTo) {
            queryParams.push(dateTo);
            query += ` AND date::date <= $${queryParams.length}`;
        }
	
        const result = await pool.query(query, queryParams);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'История не найдена' });
        }
        res.status(200).json({ history: result.rows });
    } catch (err) {
        console.error('Ошибка выполнения запроса:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});


// Остаток на складе
app.get('/products/in-shop', async (req, res) => {
    const { article, shopId, minValue, maxValue } = req.query;

    try {
        const result = await pool.query(
            'SELECT * FROM products WHERE article = $1 AND shop_id = $2 AND quantity_in_shop BETWEEN $3 AND $4',
            [article, shopId, minValue, maxValue]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Товары не найдены' });
        }

        logAction(shopId, article, "Количество остатка на складе", `Количество остатка на складе: ${result.rows[0].quantity_in_shop}`);

        res.status(200).json({ products: result.rows });
    } catch (err) {
        console.error('Ошибка выполнения запроса:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Остаток на полке
app.get('/products/on-shelf', async (req, res) => {
    const { article, shopId, minValue, maxValue } = req.query;

    try {
        const result = await pool.query(
            'SELECT * FROM products WHERE article = $1 AND shop_id = $2 AND quantity_on_shelf BETWEEN $3 AND $4',
            [article, shopId, minValue, maxValue]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Товары не найдены' });
        }

        logAction(shopId, article, "Количество остатка на полке", `Получено количество остатка на полке: ${result.rows[0].quantity_in_shop}`);

        res.status(200).json({ products: result.rows });
    } catch (err) {
        console.error('Ошибка выполнения запроса:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Остаток в заказе
app.get('/products/in-order', async (req, res) => {
    const { article, shopId, minValue, maxValue } = req.query;

    try {
        const result = await pool.query(
            'SELECT * FROM products WHERE article = $1 AND shop_id = $2 AND quantity_in_order BETWEEN $3 AND $4',
            [article, shopId, minValue, maxValue]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Товары не найдены' });
        }

        logAction(shopId, article, "Количество остатка в заказе", `Получено количество остатка в заказе: ${result.rows[0].quantity_in_shop}`);

        res.status(200).json({ products: result.rows });
    } catch (err) {
        console.error('Ошибка выполнения запроса:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.put('/products', async (req, res) => {
    let { article, shopId, quantity } = req.body;

    try {
        console.log('Полученные данные:', { article, shopId, quantity });

        if (!article || !shopId || !quantity) {
            console.log('Ошибка: Артикул, идентификатор магазина и количество обязательны');
            return res.status(400).json({ error: 'Артикул, идентификатор магазина и количество обязательны' });
        }

        const result = await pool.query(
            'UPDATE products SET quantity_in_shop = $1 WHERE article = $2 AND shop_id = $3 RETURNING *',
            [quantity, article, shopId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Товар не найден' });
        }

        console.log('Результат выполнения запроса:', result.rows[0]);

        logAction(shopId, article, "Изменение количества остатка на складе", `Новое количество остатка: ${quantity}`);

        res.status(200).json({ product: result.rows[0] });
    } catch (err) {
        console.error('Ошибка выполнения запроса:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/products', async (req, res) => {
    let { article, name, createQuantityInShop, shopId } = req.body;

    try {
        console.log('Полученные данные:', { article, name, createQuantityInShop, shopId });

        if (!article || !name || !createQuantityInShop || !shopId) {
            console.log('Ошибка: артикул, название товара, количество и ID магазина обязательны для заполнения.');
            return res.status(400).json({ error: 'Ошибка: артикул, название товара, количество и ID магазина обязательны для заполнения.' });
        }

        const existingProduct = await pool.query('SELECT * FROM products WHERE article = $1', [article]);
        
        if (existingProduct.rowCount > 0) {
            return res.status(409).json({ error: 'Товар с таким артикулом уже существует' });
        }

        const result = await pool.query(
            'INSERT INTO products (article, name, quantity_in_shop, quantity_on_shelf, quantity_in_order, shop_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [article, name, createQuantityInShop, 0, 0, shopId]
        );

        console.log('Результат выполнения запроса:', result.rows[0]);

        logAction(shopId, article, "Создание товара на складе", result.rows[0].article + " " + result.rows[0].name + ", " + result.rows[0].quantity_in_shop + "шт.");
        res.status(201).json({ product: result.rows[0] });
    } catch (err) {
        console.error('Ошибка выполнения запроса:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.listen(PORT, () => {
    console.log(`Сервер остатков товаров запущен на http://localhost:${PORT}`);
});
