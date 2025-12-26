import dotenv from 'dotenv';  // ModuleJs import ... from .... ; ishlatiladi. // CommonJsda const .... = require("....."); ishlatiladi.
dotenv.config();

import mongoose from 'mongoose';
import app from './app';

mongoose.connect(process.env.MONGO_URL as string, {})
.then((data) => {
    console.log("MongoDB connection succeed");
    const PORT = process.env.PORT ?? 3003;
    app.listen(PORT, function () {
        console.info(`The server is running successfully on port: ${PORT}`);
        console.info(`API available on http://localhost:${PORT} \n`);

    })
})
.catch((err) => console.log("ERROR on connection MongoDB", err));
