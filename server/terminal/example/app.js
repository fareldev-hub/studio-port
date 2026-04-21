const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Memberitahu Express untuk mengambil file statis dari folder 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Route utama untuk mengirimkan index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});