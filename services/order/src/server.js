const app = require("./app");
const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log(`Order Service is running on port ${PORT}`);
});
