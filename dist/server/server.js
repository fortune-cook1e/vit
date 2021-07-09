"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServer = void 0;
const koa_1 = __importDefault(require("koa"));
const chalk_1 = __importDefault(require("chalk"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const createServer = ({ port, cwd }) => {
    const htmlContent = fs_extra_1.default.readFileSync(cwd + '/index.html', 'utf-8');
    const app = new koa_1.default();
    console.log(12312312);
    app.use(async (ctx, next) => { });
    app.listen(port, () => {
        console.log(chalk_1.default.blue(`http://localhost:${port}`));
    });
};
exports.createServer = createServer;
//# sourceMappingURL=server.js.map