const router = require('express').Router();
const jwt = require('jsonwebtoken');
const moment = require('moment')
const randomstring  = require('randomstring');
const uniquerandom = require('unique-random');
const bcrypt = require('bcrypt');
let random = uniquerandom(1,500);

const {sendEmail} = require('../helperFunctions/email')
const {User} = require('../models/usermodel')

// middleare to identify valid user or not
function isAuthenticated(req, res, next){
    const access_token = req.headers['x-access-token'];
    console.log(access_token);

    if(access_token){
        jwt.verify(access_token, process.env.SECRET_KEY, (err, value)=> {
            if(err){
                return res.status(401).json({message: "Access Denied"});
            }else{
                console.log(value);
                req.userID = value.userID;
            }
            next();
        })
    }else{
        return res.status(401).json({message: "Access Denied"});
    }
}

// royte to generate voucher
router.get('/generateVoucher', isAuthenticated, async(req, res) => {
    console.log('in vocher generation');
    let user = await User.findOne({_id: req.userID});

    // if voucher is already created for an email, do not create again
    if(user.isVoucherCreated){
        res.status(200).json({msg: 'vocher already created for this email id'});
        return;
    }
    let voucherDetails = generateVoucher();
    try{
        await sendEmail(user.email, voucherDetails);
    
        res.status(200).json({
            msg: 'Voucher generated succesfully. Also send details to you mail', 
            voucherDetails
        })

        voucherDetails.pin = await bcrypt.hash(voucherDetails.pin, 10);
        let updatedUser = await User.findOneAndUpdate({_id: req.userID}, {voucherDetails: voucherDetails, isVoucherCreated: true}, {upsert: false, new: true});
        console.log(updatedUser);
    
    }catch(e){
        console.log("error=", e);
        res.status(500).json('please try after some time');
    }
})

// to generate voucher according to requirements
const generateVoucher = () => {
    console.log("generating voucher function...");
    let num = random().toString();                  // to generate random num
    console.log(num, num.length);
    let voucher = "VCD" + randomstring.generate(10 - num.length) + num;  // to generate random string of length 10- num
    console.log("voucher = ", voucher);
    let pin = randomstring.generate(5);
    console.log("pin = ", pin);
    return {
        voucher,
        pin,
        status: 'active',
        voucherAmount: 1000,
        redeemedAmount: 0,
        redeemedCount: 0,
        availableAmount: 1000,
        activityStatus: [],
        createdAt: moment().toISOString()
    }
    
}

// route to redeem voucher (all conditions are handled here)
router.post('/redeemVoucher', isAuthenticated, async(req, res)=> {
    console.log('in redeem voucher');
    let user = await User.findOne({_id: req.userID});
    let vd = Object.assign({}, user.voucherDetails);

    // comapring pin and voucher code
    if( await bcrypt.compare(req.body.pin, vd.pin) && vd.voucher == req.body.voucherCode ){
        let expirationDate = moment(vd.createdAt).add(1, 'day').toISOString();
        console.log(vd.createdAt, expirationDate);

        // checking for 24 hrs
        if( vd.createdAt < expirationDate ){
            console.log('24 hrs not over');

            // checking for limit ( 5 times)
            if(vd.redeemedCount < 5){
                console.log('limit=', vd.redeemedCount);
                let isLessThan10Min = true;

                if(vd.activityStatus.length){
                    let lastRedeemedTime = moment(vd.activityStatus[vd.activityStatus.length - 1].time);
                    isLessThan10Min = moment().diff(lastRedeemedTime, 'minutes') >= 10 ? true : false  ;
                    console.log('lastRedeemedTime', moment().diff(lastRedeemedTime, 'minutes'), isLessThan10Min);
                }

                // check for 10 min gap for each redeem
                if(isLessThan10Min){
                    vd.redeemedCount != 0 ? console.log('redeem done after 10 mins') : console.log('redeem done after 10 mins');
                    if( vd.availableAmount > 0 ) {
                        console.log('vd.availableAmount=', vd.availableAmount);

                        // check for redeem amount should be less than available amount
                        if(req.body.redeemAmount <= vd.availableAmount){
                            let balance = Math.floor(vd.availableAmount - req.body.redeemAmount);
                            console.log('balance=', balance);
                            vd.availableAmount = balance;
                            vd.redeemedAmount = vd.redeemedAmount + req.body.redeemAmount;
                            vd.redeemedCount = vd.redeemedCount + 1;

                            let currentActivity = {
                                redeemedAmount: req.body.redeemAmount,
                                time: moment().toISOString()
                            }
                            vd.activityStatus.push(currentActivity);

                            if(balance == 0)
                                vd.status = 'redeemed'
                            else
                                vd.status = 'partially redeemed';

                            console.log('vd=', vd);
                            try{
                                await User.findOneAndUpdate({_id: req.userID}, {voucherDetails: vd}, {upsert: false});
                            }catch(e){
                                console.log("error=",e);
                                res.status(500).json({msg: `please try later`});
                                return;
                            }
                        } 
                        else {
                            res.status(200).json({msg: `available balance is = ${vd.availableAmount}, please redeem within avlailable amount`});
                            return;
                        }
                    } 
                    else {
                        res.status(200).json({msg: "you've redeemed full amount"});
                        return;
                    }
                }   
                else{
                    res.status(200).json({msg: "wait for 10 mins for next redeem"});
                    return;
                }
            }
            else{
                res.status(200).json({msg: "you've crossed 5 limits to redeem"});                  
                return;
            }

        } 
        else {
            res.status(200).json({msg: "Voucher expired, 24hrs over."});
            return;
        }
        res.status(200).json({
            msg: "your voucher status",
            status: `you've redeemed ${vd.redeemedAmount}, Avl Bal is ${vd.availableAmount}, Avl limit is ${5-vd.redeemedCount}`
        });

    }else{
        res.status(200).json({msg: "voucher or pin is incorrect"});
    }

})

// route for filters
router.get('/showVouchers', isAuthenticated, async(req, res) => {
    try{
        console.log('in showVouchers');
        let filters = req.body.filters;

        // date filter
        if(filters.hasOwnProperty('date')){
            console.log('dates:', moment(filters.date.from).toISOString(), moment(filters.date.to).toISOString());
            let users = await User.find({
                createdAt: {
                    $gte: moment(filters.date.from).toISOString(),
                    $lt: moment(filters.date.to).toISOString()
                }
            });
            console.log("users in selected dates=", users);
            res.status(200).json({users});
            return;
        }

        //status filter
        if(filters.hasOwnProperty('status')){
            console.log('status:', req.body.filters.status);
            let users = await User.find({'voucherDetails.status': req.body.filters.status});
            console.log("users in selected status=", users);
            res.status(200).json({users});
            return;
            
        }

        //email filter
        if(filters.hasOwnProperty('email')){
            console.log('email:', req.body.filters.email);
            let users = await User.find({email: req.body.filters.email});
            console.log("users in selected email=", users);
            res.status(200).json({users});
            return;
        }
    }catch(e){
        console.log("error=", e);
        res.status(500).json('please try after some time');
    }
})

module.exports = router