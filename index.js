const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
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
    const bannerCollection = client.db("mediscanDB").collection("banners");
    const bookingCollection = client.db("mediscanDB").collection("bookings");

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
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

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
    app.post("/users", async (req, res) => {
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
    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    //Checking if the logging user is ADMIN or NOT
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      console.log(email);
      console.log(req.decoded);

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    //Block a user
    app.patch(
      "/users/block/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            status: "blocked",
          },
        };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    //Delete a user form DB
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // save a test to database
    app.post("/tests", async (req, res) => {
      const test = req.body;
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

    // get a specific test Data
    app.get("/testdetails/:id", async (req, res) => {
      const testId = req.params.id;
      const query = { _id: new ObjectId(testId) };
      try {
        const result = await testCollection.findOne(query);
        res.send(result);
      } catch (error) {
        console.error("Error fetching test details:", error);
        res.status(500).json({ message: "Failed to fetch test details" });
      }
    });

    //get filtered dates from present to future
    app.get("/availabletests", async (req, res) => {
      const today = new Date();
      const result = await testCollection
        .find({ testStartDate: { $gte: today.toISOString() } })
        .toArray();
      console.log(result);
      res.send(result);
    });

    // Delete a test
    app.delete("/tests/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await testCollection.deleteOne(query);
      res.send(result);
    });

    // Add A Banner
    app.post("/banners", verifyToken, async (req, res) => {
      const banner = { ...req.body, isActive: false };
      console.log(banner);
      const result = await bannerCollection.insertOne(banner);
      res.send(result);
    });

    // Get All the banners
    app.get("/banners", verifyToken, verifyAdmin, async (req, res) => {
      // console.log(req.decoded.email);
      const result = await bannerCollection.find().toArray();
      res.send(result);
    });

    //Find Active Banner
    app.get("/banners/active", async (req, res) => {
      try {
        const activeBanner = await bannerCollection
          .find({ isActive: true })
          .toArray();
        res.send(activeBanner);
      } catch (error) {
        console.error("Error fetching active banners:", error);
        res.status(500).json({ message: "Failed to fetch active banner" });
      }
    });

    // Delete A banner
    app.delete("/banners/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bannerCollection.deleteOne(query);
      res.send(result);
    });

    // make a Banner Active and others deactive status false
    app.patch("/banners/activate/:id", async (req, res) => {
      const id = req.params.id;
      try {
        // Find the banner with the given ID and update its isActive to true
        const result = await bannerCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { isActive: true } }
        );

        // Set isActive to false for other banners except the one updated
        if (result.modifiedCount > 0) {
          await bannerCollection.updateMany(
            { _id: { $ne: new ObjectId(id) } },
            { $set: { isActive: false } }
          );
        }

        res.status(200).json({ message: "Banner updated successfully" });
      } catch (error) {
        console.error("Error updating banner:", error);
        res
          .status(500)
          .json({ message: "An error occurred while updating banner" });
      }
    });

    // Payments
    // payment intent
    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, "amount inside the intent");

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    //bookings
    app.post("/bookings", verifyToken, async (req, res) => {
      const id = req.body.testId;
      const filter = { _id: new ObjectId(id) };
      const test = await testCollection.findOne(filter);
      if (test && test.slots > 0) {
        const updatedDoc = {
          $set: { slots: test.slots - 1 },
        };
        const res2 = await testCollection.updateOne(filter, updatedDoc);
        console.log(res2);

        const booking = { ...req.body, reportStatus: "pending" };
        console.log(booking);
        const result1 = await bookingCollection.insertOne(booking);
        res.send(result1);
      }
    });

    //Reservations of a single test
    app.get("/reservations/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { testId: id };
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    // Delete a Reservation
    app.delete("/reservations/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });

    //Update reservation result
    app.patch("/reservations/:id", async (req, res) => {
      const id = req.params.id;
      // const { pdfLink } = req.body.pdfLink;
      console.log(id);
      console.log(req.body.pdfLink);
      try {
        // Find the banner with the given ID and update its isActive to true
        const result = await bookingCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { pdfLink: req.body.pdfLink, reportStatus: "done" } }
        );


        if (result.modifiedCount > 0) {
          res.send(result)
        } else {
          res
            .status(404)
            .json({ message: "No booking found with the provided ID" });
        }
      } catch (error) {
        console.error("Error updating booking:", error);
        res
          .status(500)
          .json({ message: "An error occurred while updating booking" });
      }
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
