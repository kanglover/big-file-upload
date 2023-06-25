const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const cors = require('cors');

const uploadPath = path.join(__dirname, '../uploads');
const mergePath = path.join(uploadPath, 'merge');

// Create necessary directories
fs.mkdirSync(uploadPath, { recursive: true });
fs.mkdirSync(mergePath, { recursive: true });

// Middleware for parsing request body
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 允许所有源进行跨域请求
app.use(cors());

// 或者，自定义跨域配置
app.use(
    cors({
        origin: 'http://127.0.0.1:5173', // 允许的源，可以是单个字符串或字符串数组
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', // 允许的 HTTP 方法
        allowedHeaders: 'Content-Type,Authorization', // 允许的请求头
        credentials: true, // 允许发送身份凭证（如 cookies）
    })
);

// Multer configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(uploadPath, req.body.md5);
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, req.body.chunkIndex);
    },
});

const upload = multer({ storage });
// Use multer middleware for handling FormData

// Check if the file has been uploaded before
app.post('/bigfile/check', (req, res) => {
    const fileMd5 = req.query.fileMd5;
    const mergeMd5Dir = path.join(mergePath, fileMd5);

    if (fs.existsSync(mergeMd5Dir)) {
        res.json({ errno: 1 }); // File already exists
        return;
    }

    const uploadDir = path.join(uploadPath, fileMd5);
    if (!fs.existsSync(uploadDir)) {
        res.json({ errno: 0 });
        return;
    }

    const childs = fs.readdirSync(uploadDir);
    if (childs.length === 0) {
        res.json({ errno: 0 }); // File not uploaded before
    } else {
        const list = childs.map((child) => child.toString());
        res.json({ errno: 2, data: list }); // File upload interrupted with chunk indexes
    }
});

// Handle file upload
app.post('/bigfile/upload', upload.single('file'), (req, res) => {
    console.log(req.body);
    const fileMd5 = req.body.md5;
    const uploadDir = path.join(uploadPath, fileMd5);
    const childs = fs.readdirSync(uploadDir);

    res.json({ errno: 0, data: childs.length }); // Return the number of uploaded chunks as progress
});

// Merge uploaded chunks into a single file
app.post('/bigfile/merge', (req, res) => {
    const fileName = req.query.fileName;
    const fileMd5 = req.query.fileMd5;
    const uploadDir = path.join(uploadPath, fileMd5);
    const mergeMd5Dir = path.join(mergePath, fileMd5);
    const outputFile = path.join(mergeMd5Dir, fileName);

    const fileList = fs.readdirSync(uploadDir).sort((a, b) => parseInt(a) - parseInt(b));

    fs.mkdirSync(mergeMd5Dir, { recursive: true });

    const outStream = fs.createWriteStream(outputFile);

    try {
        for (const file of fileList) {
            const chunkFile = path.join(uploadDir, file);
            const chunkData = fs.readFileSync(chunkFile);
            outStream.write(chunkData);
            fs.unlinkSync(chunkFile); // Delete the chunk file
        }

        fs.rmdirSync(uploadDir); // Delete the upload directory

        res.json({ errno: 0 });
    } catch (err) {
        res.json({ errno: -1 });
        console.error(err);
        if (fs.existsSync(outputFile)) {
            fs.unlinkSync(outputFile); // Delete the output file
        }
        if (fs.existsSync(uploadDir)) {
            fs.rmdirSync(uploadDir); // Delete the upload directory
        }
    }
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
