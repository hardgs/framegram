const bot = require("./api/bot.js")
const network = require("./api/network.js");
const {filters,types} = require("./enums.js");

class App {
    constructor(token,port=8080,path="/webhook")
    {
        this.bot = new bot.Bot(token);
        console.log("Initing App Data");
        this.path = path;
        this.port = port;
        this.assets = {
            "keyboards":new Map(),
            "inlines":new Map()
        };
        this.filters = [];
        this._inlines = new Map();
    }

    addfilter(filter,isinline=false) {
        if(filter.hasOwnProperty("url")) {
            return;
        }

        if(!isinline) {
            if(!filter.hasOwnProperty("text")) {
                filter.type = types.NOFILTER;
            }
            if(!filter.hasOwnProperty("type")) {
                filter.type = types.COMMAND;
            }
            if(!filter.hasOwnProperty("filter")) {
                filter.filter = filters.ALL;
            }
            if(filter.type === types.COMMAND) {
                filter.text = "/" + filter.text;
                filter.type = types.RAW;
            }
        }

        if(!filter.hasOwnProperty("call")) {
            filter.call = async (update)=>{};
        }

        if(typeof filter.call == 'string') {
            filter.answer = String(filter.call);
            filter.call = async (update)=>{await update.reply(filter.answer)};
        }

        if(typeof filter.call == "object") {
            if(filter.call.type == "video" || filter.call.type == "voice" || filter.call.type == "photo" || filter.call.type == "audio" || filter.call.type == "document") {
                if(!filter.call.hasOwnProperty("caption"))
                    filter.call.caption = null;
                filter.fileData = {"filetype":filter.call.type,"fileid":filter.call[filter.call.type],"caption":filter.call.caption};
                filter.call = async(update)=> {
                    await update.bot.uploadFile("send"+filter.fileData.filetype,filter.fileData.filetype,filter.fileData.fileid,update.chat_id,{"caption":filter.fileData.caption});
                }
            }
        }

        if(!isinline)
            this.filters.push(filter);
        else
            this._inlines.set(filter.callback_data,filter.call);
    }

    commands(config=[])
    {
        for(const command of config) {
            this.addfilter(command);
        }
    }

    keyboards(config={})
    {
        for(const key in config) {
            const keyboard = [];
            for(const row of config[key]) {
                keyboard.push([]);
                for(const colum of row) {
                    keyboard[keyboard.length-1].push(colum.text);
                    this.addfilter({...colum,"type":types.RAW,filter:filters.PRIVATE});
                };
            }
            this.assets.keyboards.set(key,{"keyboard":keyboard});
        }
    }

    inlines(config={})
    {
        for(const key in config) {
            const inlinekeyboard = [];
            for(const row of config[key]) {
                inlinekeyboard.push([]);
                for(const colum of row) {
                    this.addfilter({...colum},true);
                    delete colum.call;
                    inlinekeyboard[inlinekeyboard.length-1].push(
                        colum
                    );
                }
            }
            this.assets.inlines.set(key,{"inline_keyboard":inlinekeyboard});
        }
    }

    isfiltered(filter,update)
    {
        switch(filter.filter) {
            case filters.ALL:
                return true;
            case filters.PRIVATE:
                if(update.type === "private")
                    return true;
                break;
            case filters.GROUP:
                if(update.type === "group")
                    return true;
                break;
            case filters.CHANNEL:
                if(update.type === "channel")
                    return true;
                break;
        }
        return false;
    }

    canRun(filter,update)
    {
        switch(filter.type) {
            case types.RAW:
                if(update.text === filter.text)
                    return true;
                break;
            case types.START:
                if(update.text == filter.text)
                    return true;
                break;
            case types.NOFILTER:
                return true;
                break;
        }
        return false;
    }

    async handle_update(data)
    {
        const first = Date.now();
        console.log("Recv: ",data);
        const update = new bot.Update(data,this.bot);
        if(!update.is_inline) {
            for(const filter of this.filters)
            {
                if(this.isfiltered(filter,update))
                    if(this.canRun(filter,update)) {
                        await filter.call(update);
                    }
            }
        } else {
            const callinline = this._inlines.get(update.callback_data);
            if(callinline)
                await callinline();
        }
        console.log("Handled In: ",(Date.now()-first)/1000);
    }
    
    addToKeyboard(keyboard,options)
    {
        this.assets.keyboards.set(keyboard,
            {...this.assets.keyboards.get(keyboard),...options}
        );
    }

    run(is_webhook=false,wait_seconds=500)
    {
        if(is_webhook) {
            console.log("App: RUN: WebHook");
            network.setupListener(this.path,async (data) =>{
                this.handle_update(data);
            },this.port);
        }
        else {
            console.log("App: RUN: Polling");
            (async ()=>{
                /* RUN: As Async Function */
                let updates = (await this.bot.request("getUpdates"));
                let offset = 0;
                if(updates.length !== 0)
                    offset = updates[updates.length-1].update_id;

                while(true)
                {
                    updates = (await this.bot.request("getUpdates",{
                        offset:offset
                    }));
                    
                    if(updates.length !== 0) {
                        offset = updates[updates.length-1].update_id + 1;
                        for(const update of updates)
                        {
                            this.handle_update(update);
                        }
                    }

                    /* SLeeping */
                    await new Promise(r => setTimeout( ()=>r(), wait_seconds));
                }
            })();
        }
    }
}

module.exports = {App,types,filters};