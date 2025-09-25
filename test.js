const {App,types,filters} = require("./index.js");

const app = new App("1699692942:r7U88lk1Osg9hgMSlfeYZ1Z6eVHbiSQlOyHyYZeN",8080);

app.commands([
    {
        text:"start",
        call:"Hello World",
        filter:filters.PRIVATE
    },
    {
        filter:filters.PRIVATE,
        call:async (update) => {
            await update.download()
        }
    }
])

app.run();