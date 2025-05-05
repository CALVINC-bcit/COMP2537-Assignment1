require("./utils.js")

require("dotenv").config();
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcrypt");
const Joi = require("joi");

let saltRounds = 12

const port = process.env.PORT || 3000;

const app = express();


const expireTime = 1 * 60 * 60 * 1000;

const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;
const mongodbUser = process.env.MONGODB_USER;
const mongodbpw = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;


const node_session_secret = process.env.NODE_SESSION_SECRET;

var {database} = include ("dbConnection");

const userCollection = database.db(mongodb_database).collection("Users");

app.use(express.urlencoded({ extended: false })); 

var mongoStore = MongoStore.create({
    mongoUrl: `mongodb+srv://${mongodbUser}:${mongodbpw}@cluster0.yd3rf6r.mongodb.net/sessions`,
    crypto: {
        secret: mongodb_session_secret
    }
});



app.use(session({
    secret: node_session_secret,
    store: mongoStore,
    saveUninitialized: false,
    resave: true
}));
app.use(express.static(__dirname + "/public"));

app.get("/", (req, res) => {
    console.log('Authenticated' + req.session.authenticated);
    if(!req.session.authenticated){
        var html = `
        <a href="/signup"><button>Sign Up</button></a><br />
        <a href="/login"><button>Login</button></a>
        `
        res.send(html);
    }
    else {
        var html = `
        <h1>Hello ${req.session.name}</h1>
        <a href="/members"><button>Go to Members Area</button></a><br />
        <a href="/logout"><button>Log out</button></a><br />
        `
        res.send(html);
    }
});

app.get("/signUp", (req, res) => {
    var html = `
    <form action="/submitUser" method="post">
    <input name="name" type="text" placeholder="name" /><br />
    <input name="username" type="email" placeholder="email" /><br />
    <input name="password" type="password" placeholder ="password" /><br />
    <button>Submit</button>
    </form>
    `;
    res.send(html);
    
});

//submits username and password
app.post("/submitUser", async (req, res) => {
    let name = req.body.name;
    let username = req.body.username;
    let password = req.body.password;
    
    const schema = Joi.object(
	{
        name:Joi.string().alphanum().max(20).required(),
        username: Joi.string().max(20).required(),
        password: Joi.string().max(20).required()
    });
    
	const validationResult = schema.validate({name, username, password});
	if (validationResult.error != null) {
	   console.log(validationResult.error);
	   res.redirect("/signUp");
	   return;
    }

    let hashedPass = await bcrypt.hashSync(password, saltRounds);
    req.session.authenticated = true;
    req.session.name = name;
    req.session.cookie.maxAge = expireTime;
   
    await userCollection.insertOne({name: name, username: username, password: hashedPass});
    console.log("Inserted user");

    res.redirect("/");
});


app.get("/login", (req, res) => {
    var html = `
    log in
    <form action="/loggingin" method="post">
    <input name="username" type="email" placeholder="email" /><br />
    <input name="password" type="password" placeholder ="password" /><br />
    <button>Submit</button>
    </form>
    `;
    res.send(html);
    
})

app.post("/loggingin", async (req, res) => {  
    let username = req.body.username;
    let password = req.body.password;

    const schema = Joi.object(
    {
        username: Joi.string().max(20).required(),
        password: Joi.string().max(20).required()
    });
    
    const validationResult = schema.validate({username, password});
    if (validationResult.error != null) {
        console.log(validationResult.error);
        res.redirect("/login");
        return;
    }
    
    const result = await userCollection.find({username:username}).project({username: 1, password: 1, name: 1, _id: 1}).toArray();
    
    if (result.length != 1) {
		console.log("user not found");
		res.redirect("/login");
		return;
	}
	if (await bcrypt.compare(password, result[0].password)) {
		console.log("correct password");
		req.session.authenticated = true;
		req.session.username = username;
        req.session.name = result[0].name;
		req.session.cookie.maxAge = expireTime;
        console.log('123 - ' + req.session.username + ' - ' + username);

		res.redirect('/');
		return;
	}
	else {
		console.log("incorrect password");
		res.redirect("/login");
		return;
	}
    // // for (i = 0; i < users.length; i++) {
    // //     if (users[i].username == username) {
    // //         if(bcrypt.compareSync(password, users[i].password)){
    // //             req.session.authenticated = true;
    // //             req.session.username = username;
    // //             req.session.cookie.maxAge = expireTime;
    // //             res.send("done1")
    // //             //res.redirect("/");
    // //             return;
    // //         }
    //     }
    // }
});

// app.get("/loggedin", (req, res) => {
//     if(!req.session.authenticated){
//         res.redirect("/login");
//     }
//     else {
//         res.redirect("/")
//     }
// });

app.get('/logout', (req,res) => {
	req.session.destroy();
    res.redirect("/");
});

app.get("/members", (req, res) => {
    if (!req.session.authenticated){
        res.redirect("/");
        return;
    }

    let randomNum = Math.floor(Math.random() * 3) + 1;
    let photoHtml = `<h2>cat${randomNum}</h2><img src='/cat${randomNum}.png' style='width:250px;'><br />`
    
    
    var html = `
        <h1>Hello ${req.session.name}</h1>
        ${photoHtml} 

       
        <a href="/logout"><button>Log out</button></a><br />`;
    res.send(html);
});

app.get("*", (req, res) => {
    res.status(404);
    res.send("Page not found - 404");
});
app.listen(port, () => {
    console.log(`Server running on local host ${port}`);
});