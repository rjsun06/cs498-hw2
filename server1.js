const express = require('express');
const mariadb = require('mariadb');
const axios = require('axios');
const app = express();
const port = 80;

const replicas = [
    'http://34.72.89.161:80',
];

app.use(express.json());

const pool = mariadb.createPool({
    host: '127.0.0.1',
    user: 'root', 
    password: 'pass1',
    database: 's1', 
    connectionLimit: 5
});


app.get('/greeting', (req, res) => {
    res.send('Hello World!');
});

app.post('/register', async (req, res) => {
    const { username, norep } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query("INSERT INTO Users (username) VALUES (?)", [username]);
        if(!norep) {
            const writePromises = replicas.map(replica =>
                axios.post(`${replica}/register`, { username, norep: true})
            );

            await Promise.all(writePromises);
        }
        res.status(201).json({ message: `User ${username} registered successfully` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    } finally {
        if (conn) conn.release(); // Release the connection back to the pool
    }
});

app.get('/list', async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query("SELECT username FROM Users");
        const users = rows.map(row => row.username);
        res.status(200).json({ users });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    } finally {
        if (conn) conn.release(); // Release the connection back to the pool
    }
});

app.post('/clear', async (req, res) => {
    const { norep } = req.body;
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query("DELETE FROM Users"); // Delete all rows from the Users table

        if(!norep) {
            const writePromises = replicas.map(replica =>
                axios.post(`${replica}/clear`, { norep: true})
            );

            await Promise.all(writePromises);
        }

        res.status(200).json({ message: 'All users cleared successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    } finally {
        if (conn) conn.release();
    }
});

const startServer = async () => {
    let res = await axios.get('http://ifconfig.me')
    let ip = res.data;

    app.listen(port, () => {
        console.log(`Server is running on http://${ip}:${port}`);
    });
};

// Start the server
startServer();
