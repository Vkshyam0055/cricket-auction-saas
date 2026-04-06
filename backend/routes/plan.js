const express = require('express');
const router = express.Router();
const Plan = require('../models/Plan');
const fetchOrganizer = require('../middleware/fetchOrganizer');

// 🌟 पब्लिक रूट: लैंडिंग पेज के लिए सभी प्लान्स लाना
router.get('/', async (req, res) => {
    try {
        let plans = await Plan.find();
        
        // 🌟 AUTO-SEED MAGIC: अगर डेटाबेस खाली है, तो डिफ़ॉल्ट प्लान्स बना दो
        if (plans.length === 0) {
            const defaultPlans = [
                { name: 'Basic', price: 499, subtitle: 'छोटी लीग और क्लब्स के लिए', features: ['Up to 50 Players', 'Unlimited Teams', 'Live Projector Screen'] },
                { name: 'Pro', price: 999, subtitle: 'प्रोफेशनल टूर्नामेंट्स के लिए', features: ['Up to 200 Players', 'Unlimited Teams', 'Live Projector Screen', 'Public Registration Link'], isPopular: true },
                { name: 'Premium', price: 1999, subtitle: 'बड़ी लीग और अनलिमिटेड यूज़', features: ['Unlimited Players', 'Unlimited Teams', 'Custom Branding & Logo', 'Priority Support'] }
            ];
            await Plan.insertMany(defaultPlans);
            plans = await Plan.find(); // वापस नया डेटा ले आओ
        }
        res.json(plans);
    } catch (error) {
        res.status(500).json({ message: "प्लान्स लाने में एरर!" });
    }
});

// 🌟 एडमिन रूट: किसी भी प्लान की कीमत या डिटेल्स बदलना (SuperAdmin Only)
router.put('/:id', fetchOrganizer, async (req, res) => {
    try {
        if (req.user.role !== 'SuperAdmin') return res.status(403).json({ message: "Access Denied!" });
        
        const updatedPlan = await Plan.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ message: "प्लान अपडेट हो गया!", plan: updatedPlan });
    } catch (error) {
        res.status(500).json({ message: "प्लान अपडेट करने में एरर!" });
    }
});

module.exports = router;