const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 5000;

// MiddleWare
app.use(express.json());
app.use(cors());
app.use(cookieParser());

// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1fkl4oh.mongodb.net/?retryWrites=true&w=majority`;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.llady87.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    //   await client.connect();
    const districtCollection = client.db("mediscanDB").collection("district");
    const upazilaCollection = client.db("mediscanDB").collection("upazilas");
    const userCollection = client.db("mediscanDB").collection("users");
    const testCollection = client.db("mediscanDB").collection("tests");

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // middlewares
    const verifyToken = (req, res, next) => {
      // console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    //Verify Admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }

    //find all district
    app.get("/district", async (req, res) => {
      const result = await districtCollection.find().toArray();
      res.send(result);
    });
    //Finad all Upazila
    app.get("/upazila", async (req, res) => {
      const result = await upazilaCollection.find().toArray();
      res.send(result);
    });

    //Save user to db
    app.post("/users",  async (req, res) => {
      const user = { status: "active", ...req.body };
      console.log(user);
      const result = await userCollection.insertOne(user);
      res.send(result);
    });


    //get all users
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      // console.log(req.decoded.email);
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    //Make a user an ADMIN
    app.patch("/users/admin/:id",verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    //Checking if the logging user is ADMIN or NOT
    app.get("/users/admin/:email",verifyToken, async (req, res) => {
      const email = req.params.email;
      console.log(email);
      console.log(req.decoded);

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    })

    //Block a user
    app.patch("/users/block/:id",verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: "blocked",
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    //Delete a user form DB
    app.delete("/users/:id",verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // save a test to database
    app.post("/tests",  async (req, res) => {
      const test = req.body
      // console.log(test);
      const result = await testCollection.insertOne(test);
      res.send(result);
    });

    // Get all tests
    app.get("/tests", verifyToken, async (req, res) => {
      // console.log(req.decoded.email);
      const result = await testCollection.find().toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    //   await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Mediscan server is running.");
});

app.listen(port, () => {
  console.log(`Mediscan listening on port ${port}`);
});
