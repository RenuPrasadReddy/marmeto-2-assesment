const mongoose = require('mongoose');

let userSchema = mongoose.Schema({
    email:{
        type: String
    },
    password: String,
    isVoucherCreated: Boolean,
    voucherDetails: Object,
});

const User = mongoose.model("User", userSchema);

module.exports = {User};