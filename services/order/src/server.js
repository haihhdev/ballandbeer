const app = require("./app");
const PORT = process.env.PORT || 8001;

app.listen(PORT, () => {
  console.log(`Order Service is running on port ${PORT}`);
});
