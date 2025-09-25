const network = require("./network.js");
const fs = require("fs");

class Bot {
  constructor(token,host ="https://tapi.bale.ai/") {
    this.token = token;
    this.endpoint = host;
    this.MAX_MESSAGE_LENGTH = 4096; // App's limit
  }

  async request(name, data={})
  {
    const result = (JSON.parse(
      (await network.post(`${this.endpoint}bot${this.token}/${name}`, data)).response
    ));

    if(result.ok)
      return result.result;
    else
      return result;
  }

  async getMe()
  {
    return await this.request("getme");
  }

  async getChat(chat_id)
  {
    return await this.request("getChat",{"chat_id":chat_id});
  }

  async getChatMembersCount(chat_id)
  {
    return await this.request("getChatMembersCount",{"chat_id":chat_id});
  }

  async getFile(file_id)
  {
    return await this.request("getFile",{
      "file_id":file_id
    })
  }

  async pinChatMessage(chat_id,message_id)
  {
    return await this.request("pinChatMessage",{"chat_id":chat_id,"message_id":message_id});
  }

  async unPinChatMessage(chat_id,message_id)
  {
    return await this.request("unPinChatMessage",{
      "chat_id":chat_id,
      "message_id":message_id
    });
  }

  async forwardMessage(chat_id,message_id,from_chat_id)
  {
    return await this.request("forwardMessage",{
      "message_id":message_id,
      "chat_id":chat_id,
      "from_chat_id":from_chat_id
    });
  }

  async copyMessage(chat_id,message_id,from_chat_id)
  {
    return await this.request("copyMessage",{
      "chat_id":chat_id,
      "message_id":message_id,
      "from_chat_id":from_chat_id
    });
  }

  async deleteMessage(chat_id,message_id)
  {
    return await this.request("deleteMessage",{
      "chat_id":chat_id,
      "message_id":message_id
    });
  }

  async banChatMember(chat_id,user_id)
  {
    return this.request("banChatMember",{
      "chat_id":chat_id,
      "user_id":user_id
    });
  }
  async unbanChatMember(chat_id,user_id)
  {
    return await this.request("unbanChatMember",{
      "chat_id":chat_id,
      "user_id":user_id
    });
  }

  async leaveChat(chat_id)
  {
    return await this.request("leaveChat",{
      "chat_id":chat_id
    });
  }

  async uploadFile(method,filetype,file,chat_id,options={})
  {
    if(file.startsWith("http://") || file.startsWith("https://")) {
      return await this.request(method,{
        "chat_id":chat_id,
        [filetype]:file,
        ...options
      });
    } else {
      try {
        await fs.promises.access(file)
        return await network.uploadFile(`${this.endpoint}${this.token}/${method}`,{
          "chat_id":chat_id,
          [filetype]:fs.createReadStream(file),
          ...options
        });

      } catch(e) {
          return await this.request(method,{
            "chat_id":chat_id,
            [filetype]:file,
            ...options
          });
      }
    }
  }
  
  async sendDocument(file,chat_id,caption=null,options={})
  {
    /* First Check Way To Send File */
    return await this.uploadFile("sendDocument","document",file,chat_id,{
      "caption":caption,
      ...options
    })
  }
  
  async sendVideo(video,chat_id,caption=null,options={})
  {
    /* First Check Way To Send File */
    return await this.uploadFile("sendVideo","video",video,chat_id,{
      "caption":caption,
      ...options
    })
  }

  async sendVoice(voice,chat_id,caption=null,options={})
  {
    /* First Check Way To Send File */
    return await this.uploadFile("sendVoice","voice",voice,chat_id,{
      "caption":caption,
      ...options
    })
  }

  async sendPhoto(photo,chat_id,caption=null,options={})
  {
    /* First Check Way To Send File */
    return await this.uploadFile("sendPhoto","photo",photo,chat_id,{
      "caption":caption,
      ...options
    })
  }

  async sendAudio(audio,chat_id,caption=null,options={})
  {
    /* First Check Way To Send File */
    return await this.uploadFile("sendAudio","audio",audio,chat_id,{
      "caption":caption,
      ...options
    })
  }

  /* So Add Some Methods */
  async sendMessage(chat_id,text,input)
  {
    return await this.request("sendMessage",{
      "chat_id":chat_id,
      "text":text,
      ...input
    });
  }

  async editMessageText(chat_id,message_id,text,options)
  {
    return await this.request("editMessageText",{
      "chat_id":chat_id,
      "message_id":message_id,
      "text":text,
      ...options
    });
  }

  async editMessageCaption(chat_id,message_id,caption,options)
  {
    return await this.request("editMessageCaption",{
      "chat_id":chat_id,
      "message_id":message_id,
      "caption":caption,
      ...options
    });
  }

  async answerCallbackQuery(callback_query_id,text=null,show_alert=null)
  {
    return await this.request("answerCallbackQuery",{
      "callback_query_id":callback_query_id,
      "text":text,
      "show_alert":show_alert
    });
  }
}

class Update {
  constructor(data,bot)
  {
    this.data = data;
    this.is_inline = false;
    /* Parsing And Processing Callback */
    if(data.hasOwnProperty("callback_query")) {
      this.is_inline = true;
      this.is_edited = false;
      this.data = data.callback_query;
      this.message = this.data.message;
      this.callback_data = this.data.data;
    } else {
      if(data.hasOwnProperty("edited_message")) {
        this.is_edited = true;
        this.message = data.edited_message;
      }
      else {
        this.is_edited = false;
        this.message = data.message;
      }
      this.type = this.message.chat.type;
    }

    if(this.message.hasOwnProperty("left_chat_member") || this.message.hasOwnProperty("new_chat_members"))
    {
      this.is_event = true;
    }

    /* Some Usually Data */
    this.bot = bot;
    this.chat_id = this.message.chat.id;
    this.user_id = this.message.from.id;
    this.text = this.message.text;
    this.id = this.message.message_id;
  }

  async download(output_path=null)
  {
    let filetype = "";
    if(this.message.hasOwnProperty("document"))
      filetype = "document"
    else if(this.message.hasOwnProperty("photo"))
      filetype = "photo"
    else if(this.message.hasOwnProperty("video"))
      filetype = "video"
    else if(this.message.hasOwnProperty("voice"))
      filetype = "voice"
    else if(this.message.hasOwnProperty("music"))
      filetype = "music"
    else 
      return
    const file_url_path = (await this.bot.getFile(this.message[filetype]["file_id"]))["file_path"];
    
    if(output_path==null)
      output_path = this.message[filetype]["file_name"]
    
    await network.download("GET",
      this.bot.endpoint+"file/bot"+this.bot.token+"/"+file_url_path,
      output_path);

  }

  async reply(text,options={})
  {
    return await this.bot.sendMessage(this.chat_id,text,{"reply_to_message_id":this.id,...options});
  }

  async reply_photo(photo,caption=null,options={})
  {
    return await this.bot.sendPhoto(photo,this.chat_id,caption,{"reply_to_message_id":this.id,...options});
  }

  async reply_document(document,caption=null,options={})
  {
    return await this.bot.sendDocument(document,this.chat_id,caption,{"reply_to_message_id":this.id,...options});
  }

  async reply_video(video,caption=null,options={})
  {
    return await this.bot.sendVideo(video,this.chat_id,caption,{"reply_to_message_id":this.id,...options});
  }

  async reply_voice(voice,caption=null,options={})
  {
    return await this.bot.sendVoice(voice,this.chat_id,caption,{"reply_to_message_id":this.id,...options});
  }

  async reply_audio(audio,caption=null,options={})
  {
    return await this.bot.sendAudio(audio,this.chat_id,caption,{"reply_to_message_id":this.id,...options});
  }

  async delete()
  {
    return await this.bot.deleteMessage(this.chat_id,this.id);
  }

  async edit(text,options={})
  {
    if(this.message.hasOwnProperty("video") || this.message.hasOwnProperty("voice") || this.message.hasOwnProperty("audio") || this.message.hasOwnProperty("document") || this.message.hasOwnProperty("photo"))
      return await this.bot.editMessageCaption(this.chat_id,this.id,text,options);
    else
      return await this.bot.editMessageText(this.chat_id,this.id,this.text,options);
  }

  async pin()
  {
    return await this.bot.pinChatMessage(this.chat_id,this.id);
  }

  async unpin()
  {
    return await this.bot.unPinChatMessage(this.chat_id,this.id);
  }

  async forward(chat_id)
  {
    return await this.bot.forwardMessage(chat_id,this.id,this.chat_id);
  }

  async ban()
  {
    return await this.bot.banChatMember(this.chat_id,this.user_id);
  }

  async unban()
  {
    return await this.bot.unbanChatMember(this.chat_id,this.user_id);
  }

  async copy(chat_id)
  {
    return await this.bot.copyMessage(chat_id,this.id,this.chat_id);
  }

  async leave()
  {
    return await this.bot.leaveChat(this.chat_id);
  }

  async answer(text=null,show_alert=null)
  {
    return await this.bot.answerCallbackQuery(this.data.id,text,show_alert);
  }

};

module.exports = { Bot,Update };