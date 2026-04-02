const jwt = require('jsonwebtoken');

const fetchOrganizer = (req, res, next) => {
    // फ्रंटएंड से आने वाला टोकन पकड़ना
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN" से सिर्फ टोकन निकालना

    if (!token) {
        return res.status(401).json({ message: "पहुंच के लिए मान्य टोकन नहीं है। कृपया लॉग-इन करें!" });
    }

    try {
        // टोकन को डिकोड करके उसमें से Organizer की ID निकालना
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // अब req.user.id में मालिक की ID सुरक्षित है
        next(); // गार्ड ने गेट खोल दिया, आगे जाने दो
    } catch (error) {
        res.status(401).json({ message: "टोकन अमान्य या एक्सपायर हो चुका है!" });
    }
};

module.exports = fetchOrganizer;