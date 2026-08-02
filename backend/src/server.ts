import app from "./app";

const PORT = Number(process.env.PORT) || 8080;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
