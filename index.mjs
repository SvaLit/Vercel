import {RenderThread, readableFrom, render} from "svalit/render.mjs"
import {resetImports} from "svalit/loader.mjs";

export default class RenderStream extends RenderThread {
    constructor({req, res, ...options} = {}) {
        super(options);
        Object.assign(this, {req, res})
    }

    async renderTemplate(template) {
        globalThis.renderInfo = {customElementHostStack: [], customElementInstanceStack: []}
        this.stream = readableFrom(render(template(this), globalThis.renderInfo), true)
        this.stream.on('end', this.streamHandler.bind(this))
        for await (let chunk of this.stream) this.chunks.push(Buffer.from(chunk))
    }

    metaHandler({title = this.meta.title, status = 200} = {}) {
        if (title) this.meta.title = title;
        if (status) this.meta.status = status;
        if (this.meta.status) this.res.status(this.meta.status)
        this.res.setHeader('Content-Disposition', 'inline');
        this.res.setHeader('Access-Control-Allow-Origin', '*');
        this.res.setHeader('Content-Type', this.meta.type || 'text/html; charset=utf-8');
        this.res.write(this.headTemplate())
        this.res.write(Buffer.concat(this.chunks))
        this.stream.pipe(this.res, {end: false});
        this.chunks = []
    }

    async streamHandler() {
        this.renderEvents.emit('meta', {})
        const footer = this.importMapOptions.disableGeneration ? this.footerTemplate() :
            await this.importMapGenerator.htmlGenerate(this.footerTemplate(), this.generationOptions)
        resetImports()
        const updatedFooter = this.disableImports(footer)
        return this.res.end(this.shim ? this.shimScripts(updatedFooter) : updatedFooter)
    }
}
