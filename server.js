import express from 'express'
import multer from 'multer'
import forge from 'node-forge'
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib'
import { plainAddPlaceholder } from '@signpdf/placeholder-plain'
import { P12Signer } from '@signpdf/signer-p12'
import pkg from '@signpdf/signpdf'
import * as fs from 'fs';
import fontkit from '@pdf-lib/fontkit'

const version = "v1.121"
const signpdf = pkg.default
const API_TOKEN = process.env.API_TOKEN


const app = express()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } })

app.use((req, res, next) => {
  const token = req.headers['x-api-token']
  if (!token || token !== API_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
})

function checkSum128(data, startCode) {
  var sum = startCode;
  for (var i = 0; i < data.length; i++) {
    var code = data.charCodeAt(i);
    var value = code > 199 ? code - 100 : code - 32;
    sum += (i + 1) * (value);
  }

  var checksum = (sum % 103) + 32;
  if (checksum > 126) checksum = checksum + 68 ;
  return String.fromCharCode(checksum);
}

function encodeToCode128(text, codeABC = "B") {
  var startCode = String.fromCharCode(codeABC.toUpperCase().charCodeAt() + 138);
  var stop = String.fromCharCode(206);

  text = codeABC == 'C' && toSetC(text) || text;

  var check = checkSum128(text, startCode.charCodeAt(0) - 100);

  text = text.replaceAll(" ", String.fromCharCode(194));

  return startCode + text + check + stop;
}

function getCNFromP12(p12Buffer, passphrase) {
  const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'))
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, passphrase)
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
  const cert = certBags[forge.pki.oids.certBag][0].cert
  const cn = cert.subject.getField('CN')
  return cn ? cn.value : 'Unbekannt'
}

async function addSignatureFooter(pdfBuffer, signerNames, lang, pos) {
  const pdfDoc = await PDFDocument.load(pdfBuffer)
  
  pdfDoc.registerFontkit(fontkit)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const pages = pdfDoc.getPages()
  const signedAt = new Date().toLocaleString('de-DE', {
    timeZone: 'Europe/Berlin'
  })
  let signedAt2 = signedAt
  const signedAtEN = new Date().toLocaleString('en-EN', {
    timeZone: 'Europe/Berlin'
  })
  let signedAtEN2 = signedAtEN

  let signerName = signerNames[0]
  let signerName2 = ""
  let encodedText2 =""
  let signedMessage2 = ""
  let barcodeWidth2 = 0

  const fontBytes = fs.readFileSync('/app/LibreBarcode128-Regular.ttf');
      
  const barcodeFont = await pdfDoc.embedFont(fontBytes, { subset: true });
  const encodedText = encodeToCode128(signerName); 

  var signedMessage = `PDF digital signiert von ${signerName} am ${signedAt}`
  if(lang == "en"){
        signedMessage = `PDF digitally signed by ${signerName} on ${signedAtEN}`
  }
  let barcodeWidth = barcodeFont.widthOfTextAtSize(encodedText,15)

  if (signerNames.length >1){
      await new Promise(resolve => setTimeout(resolve, 1000));
      signedAt2 = new Date().toLocaleString('de-DE', {
        timeZone: 'Europe/Berlin'
      })
      signedAtEN2 = new Date().toLocaleString('en-EN', {
        timeZone: 'Europe/Berlin'
      })
      signerName2 = signerNames[1]
      encodedText2 = encodeToCode128(signerName2); 
      signedMessage2 = `PDF digital signiert von ${signerName2} am ${signedAt2}`
      if(lang == "en"){
        signedMessage2 = `PDF digitally signed by ${signerName2} on ${signedAtEN2}`
      }
      barcodeWidth2 = barcodeFont.widthOfTextAtSize(encodedText2,15)
      if(barcodeWidth2 > barcodeWidth) barcodeWidth = barcodeWidth2
  }  
    
  let pageCounter = 0
  for (const page of pages) {
        const { width, height } = page.getSize()
        //console.log("width:"+width)
        //console.log("height:"+height)
        //console.log("pos: "+pos)

        
      
        let hXstart = width * 0.0675//40
        let hYstart = width * 0.02688// 16
        let offsetXsignedMessage = 10+barcodeWidth
        let offsetXcheckMessage = 400
        let offsetXline = offsetXsignedMessage
        let offsetYsignedMessage = 1
        let offsetYcheckMessage = 1
        let offsetYline = 8
        let rotationDegrees = 0
        let lineXend = width - hXstart
        let lineYend = hYstart+offsetYline
        let checkMessageOpacity = 1
        let hXstart2 = hXstart
        let hYstart2 = hYstart-9.6
        let offsetXsignedMessage2 =  offsetXsignedMessage
        let offsetYsignedMessage2 = offsetYsignedMessage
      
        if(pos == "left"){
                hXstart = width * 0.038// 32
                hYstart = height * 0.19//40
                offsetYsignedMessage = 10+barcodeWidth
                offsetYcheckMessage = 405
                offsetYline = offsetYsignedMessage
                offsetXsignedMessage = -1//120
                offsetXcheckMessage = -1//395
                offsetXline = -8
                lineXend = hXstart+offsetXline
                lineYend = height-hYstart
                rotationDegrees = 90
                hXstart2 = hXstart+9.6
                hYstart2 = hYstart
                offsetXsignedMessage2 = offsetXsignedMessage
                offsetYsignedMessage2 = offsetYsignedMessage
        }
        if ( pos == "no"){
              checkMessageOpacity = 0
        }
      
        if(pos != "no"){
                page.drawText(encodedText, {
                    x: hXstart,
                    y: hYstart,
                    size: 15,
                    font: barcodeFont,
                    rotate: degrees(rotationDegrees),
                });
                page.drawLine({
                  start: { x: hXstart+offsetXline, y: hYstart+offsetYline },
                  end: { x: lineXend, y: lineYend },
                  thickness: 0.5,
                  color: rgb(0.6, 0.6, 0.6),
                })  
                
                page.drawText(signedMessage, {
                  x: (hXstart+offsetXsignedMessage),
                  y: (hYstart+offsetYsignedMessage),
                  size: 7,
                  font,
                  color: rgb(0.2, 0.2, 0.2),
                  rotate: degrees(rotationDegrees),
                })
                if(signerName2.length >0){
                    page.drawText(encodedText2, {
                        x: hXstart2,
                        y: hYstart2,
                        size: 15,
                        font: barcodeFont,
                        rotate: degrees(rotationDegrees),
                    });
                    page.drawText(signedMessage2, {
                      x: (hXstart2+offsetXsignedMessage2),
                      y: (hYstart2+offsetYsignedMessage2),
                      size: 7,
                      font,
                      color: rgb(0.2, 0.2, 0.2),
                      rotate: degrees(rotationDegrees),
                    })
                }
                
        }
        var checkMessage = '    Signatur prüfbar in Adobe Acrobat'
        if(lang == "en"){
                checkMessage = 'Signature verifiable in Adobe Acrobat'
        }
            
        page.drawText(checkMessage, {
                  x: (hXstart+offsetXcheckMessage),
                  y: (hYstart+offsetYcheckMessage),
                  size: 7,
                  font,
                  color: rgb(0.5, 0.5, 0.5),
                  rotate: degrees(rotationDegrees),
                  opacity: checkMessageOpacity,
        })
            
        pageCounter = pageCounter+1
  }
  pdfDoc.setProducer('https://github.com/emsi76/node-js_pdf-signer '+version)
  return Buffer.from(await pdfDoc.save({ useObjectStreams: false }))
}

app.post('/sign', upload.single('pdf'), async (req, res) => {
  try {
    //console.log('body:', JSON.stringify(req.body))
    //console.log('file:', req.file?.originalname, req.file?.size)
    const p12Url = req.body.p12_url
    const p12Passphrase = req.body.p12_passphrase
    const token = req.body.token
    let lang = req.body.lang
    let pos = req.body.pos

    if (!p12Url || !p12Passphrase || !token) {
      return res.status(400).json({ error: 'p12_url, p12_passphrase und token erforderlich' })
    }
    if (!lang){
        lang = "de"
    }
    if (!pos){
        pos = "no"
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Keine PDF-Datei empfangen' })
    }
    
    // P12 laden
    const response = await fetch(p12Url, {
      method: "GET",
      headers: {
        "Authorization": token,
        "Accept": "application/vnd.github.raw",
          
      },
      
    });
    if (!response.ok) throw new Error(`P12 laden fehlgeschlagen: ${response.status}`)
    const p12Buffer = Buffer.from(await response.arrayBuffer())

    // CN auslesen
    const signerName = getCNFromP12(p12Buffer, p12Passphrase)
    let signerNames = []
    signerNames[0] = signerName
    // Footer hinzufügen
    const pdfWithFooter = await addSignatureFooter(req.file.buffer, signerNames, lang, pos)
    // Platzhalter für Signatur
    const pdfWithPlaceholder = plainAddPlaceholder({
      pdfBuffer: pdfWithFooter,
      reason: 'Digitale Signatur',
      name: signerNames[0],
      location: 'Deutschland',
    })

    // Kryptografisch signieren
    const signer = new P12Signer(p12Buffer, { passphrase: p12Passphrase })
    const signedPdf = await signpdf.sign(pdfWithPlaceholder, signer)

    res.set('Content-Type', 'application/pdf')
    res.set('Content-Disposition', 'attachment; filename="signiert.pdf"')
    res.send(signedPdf)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

app.post('/multisign', upload.single('pdf'), async (req, res) => {
      try {
    //console.log('body:', JSON.stringify(req.body))
    //console.log('file:', req.file?.originalname, req.file?.size)
    const p12Url = req.body.p12_url
    const p12Passphrase = req.body.p12_passphrase
    const p12Url2 = req.body.p12_url2
    const p12Passphrase2 = req.body.p12_passphrase2
    const token = req.body.token
    let lang = req.body.lang
    let pos = req.body.pos

    if (!p12Url || !p12Passphrase || !token) {
      return res.status(400).json({ error: 'p12_url, p12_passphrase und token erforderlich' })
    }
    if (!p12Url2 || !p12Passphrase2) {
      return res.status(400).json({ error: 'p12_url2, p12_passphrase2 erforderlich' })
    }
    if (!lang){
        lang = "de"
    }
    if (!pos){
        pos = "no"
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Keine PDF-Datei empfangen' })
    }
    
    // P12 laden
    const response = await fetch(p12Url, {
      method: "GET",
      headers: {
        "Authorization": token,
        "Accept": "application/vnd.github.raw",
          
      },
      
    });
    if (!response.ok) throw new Error(`P12 laden fehlgeschlagen: ${response.status}`)
    const p12Buffer = Buffer.from(await response.arrayBuffer())

    // CN auslesen
    const signerName = getCNFromP12(p12Buffer, p12Passphrase)

    // P12 2 laden
    const response2 = await fetch(p12Url2, {
      method: "GET",
      headers: {
        "Authorization": token,
        "Accept": "application/vnd.github.raw",
          
      },
      
    });
    if (!response2.ok) throw new Error(`P12 2 laden fehlgeschlagen: ${response2.status}`)
    const p12Buffer2 = Buffer.from(await response2.arrayBuffer())

    // CN auslesen
    const signerName2 = getCNFromP12(p12Buffer2, p12Passphrase2)
    //console.log("2. signer "+signerName2)
    let signerNames = []
    signerNames[0] = signerName
    signerNames[1] = signerName2
          
    // Footer hinzufügen
    const pdfWithFooter = await addSignatureFooter(req.file.buffer, signerNames, lang, pos)
    // Platzhalter für Signatur
    const pdfWithPlaceholder = plainAddPlaceholder({
      pdfBuffer: pdfWithFooter,
      reason: 'Digitale Signatur',
      name: signerName,
      location: 'Deutschland',
    })

    // Kryptografisch signieren
    const signer = new P12Signer(p12Buffer, { passphrase: p12Passphrase })
    const signedPdf1 = await signpdf.sign(pdfWithPlaceholder, signer)

        // Platzhalter für Signatur
    const pdfWithPlaceholder2 = plainAddPlaceholder({
      pdfBuffer: signedPdf1,
      reason: 'Digitale Signatur',
      name: signerName2,
      location: 'Deutschland',
    })

        // Kryptografisch signieren
    const signer2 = new P12Signer(p12Buffer2, { passphrase: p12Passphrase2 })
    const signedPdf2 = await signpdf.sign(pdfWithPlaceholder2, signer2)

    res.set('Content-Type', 'application/pdf')
    res.set('Content-Disposition', 'attachment; filename="signiert.pdf"')
    res.send(signedPdf2)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

app.listen(3000, () => console.log('Server läuft auf Port 3000'))
