const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const {User} = require('../models/usermodel');

router.post('/signup', async(req, res)=> {
    console.log('in signup...');
    // const user = { email: req.body.email }
    try{
        const existingUserOrNot = await User.findOne({email: req.body.email});
        if(!existingUserOrNot){
            // const salt = await bcrypt.genSalt();
            // const hashedPassword = await bcrypt.hash(req.body.password, salt);
            const hashedPassword = await bcrypt.hash(req.body.password, 10);
            const result = await User.create({email: req.body.email, password: hashedPassword});
            res.status(200).json("sign up successfull");

        }else{
            res.status(200).json('this email is already registered, please try other email or login')
        }
        
    }catch(e){
        res.status(500).json('could not signup now, please try after some time')
    }
    
});

router.post('/login', async (req, res) => {
    console.log('in login...');
    try{
        const user = await User.findOne({email: req.body.email});
        console.log('user=', user);

        if(!user){
            return res.status(200).send("email is not registered")
        }else{
            if(await bcrypt.compare(req.body.password, user.password)){
                const access_token = jwt.sign({userID: user._id}, process.env.SECRET_KEY, {expiresIn: "60m"});
                res.status(200).send({msg:'logged in successfully', access_token});
            }else{
                res.status(200).send('incorrect password, please try again');
            }
        }
    }catch(e){
        console.log(e);
        
        res.status(500).json('could not login now, please try after some time')
    }
});


module.exports = router;