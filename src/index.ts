import express, { Request, Response } from "express";
import path from "node:path";
import { MODEL_MAPPINGS } from "./models";

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use(express.static(path.join(__dirname, '..', 'website', 'static'), { dotfiles: "ignore" }));

app.get("/", (request: Request, response: Response) => {
    response.render('index');
});

app.listen(80, '0.0.0.0');