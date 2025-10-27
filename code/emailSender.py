import smtplib
import ssl
import time
import os
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from email.utils import formataddr
import pymongo
from dotenv import load_dotenv

# Configure logging
# Ensure logs directory exists
logs_dir = '/home/ubuntu/cryptocode-dev/logs'
if not os.path.exists(logs_dir):
    os.makedirs(logs_dir)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(f'{logs_dir}/email_sender.log', mode='a'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('EmailSender')
logger.info("Logging initialized")

load_dotenv()

your_email_address = "support@thecryptosnipers.com"
your_email_password = "Manisha@ANG#13"
recipient_email_address = "vipinpal7080@gmail.com"
your_smtp_server = "smtpout.secureserver.net"
your_smtp_port = 465
your_company_name = "Crypto Snipers"
logo_path = os.path.join(os.path.dirname(__file__), "assets", "CS2.png")


def send_welcome_email(sender_email: str=your_email_address, sender_password: str=your_email_password, recipient_email: str=recipient_email_address,
                      smtp_server: str=your_smtp_server, smtp_port: int=your_smtp_port, company_name: str=your_company_name,
                      logo_path: str=logo_path) -> bool:
    """
    Send a welcome email to the new user.
    
    Args:
        sender_email (str): Email address of the sender
        sender_password (str): Password for the sender's email
        recipient_email (str): Email address of the recipient
        smtp_server (str): SMTP server address
        smtp_port (int): SMTP server port
        company_name (str): Name of the company
        
    Returns:
        bool: True if email was sent successfully, False otherwise
    """
    try:
        logger.info(f"Preparing welcome email for {recipient_email}")
        # Create the email message
        message = MIMEMultipart("alternative")
        message["Subject"] = f"Welcome to {company_name} - Your Trading Journey Begins!"
        message["From"] = formataddr((company_name, sender_email))
        message["To"] = recipient_email

        # Create the plain-text version of your message
        text = f"""\
        Welcome to {company_name}!

        You've just taken your first step into the future of crypto trading with {company_name} – India's first-of-its-kind algorithmic trading platform for cryptocurrencies!

        Getting Started with {company_name}:

        1. New here and haven't signed up via referral?
        👉 Fill out this quick form to register: 
        https://docs.google.com/forms/d/e/1FAIpQLSd9YLlh8fy0oRhTxco1gVIOhKkBpzrollp1PsQVePAQGEdLkg/viewform

        2. Add your Broker
        🔗 Add your broker using the User Id, API and Secret API key from your Delta Exchange account.

        3. Approval Process
        ⏳ Once you've added your account, please wait for approval from our team.

        4. Deploy a Strategy
        📈 After approval, choose and deploy the trading strategy that best fits your goals.

        5. Minimum Capital Requirement
        💰 Each strategy needs a minimum of $500 or ₹50,000 to begin.

        Let the Sniper Take Over:
        🎯 Sit back and relax while the Snipers execute trades for you, 24/7!

        Need Help?
        Our expert support team is here to assist you:
        ✉️ Email: support@thecryptosnipers.com

        Happy Trading,
        The {company_name} Team
        """

        # Create the HTML version of your message with inline styles and image reference
        html = f"""\
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to {company_name}</title>
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background: #f8fafc; color: #1e293b; line-height: 1.6;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                <div style="background: #000000; padding: 40px 30px; text-align: center; position: relative; overflow: hidden;">
                    <div style="margin-bottom: 15px;">
                        <img src="cid:logo" alt="{company_name} Logo" style="max-width: 200px; height: auto;">
                    </div>
                    <div style="font-size: 18px; color: rgba(255, 255, 255, 0.9); position: relative; z-index: 2; font-weight: 400; letter-spacing: 0.5px;">
                        The Crypto Snipers - Real Future of Trading begins here!
                    </div>
                </div>
                
                <div style="padding: 40px 30px;">
                    <div style="font-size: 24px; font-weight: 600; margin-bottom: 20px; text-align: center; color: #2563ea; line-height: 1.3;">
                        Welcome to the Future of Trading
                    </div>
                    <div style="font-size: 16px; font-weight: 500; text-align: center; color: #000000; margin-bottom: 40px;">
                        You've just taken your first step into the future of crypto trading with {company_name} – India's first-of-its-kind algorithmic trading platform for cryptocurrencies!
                    </div>
                    
                    <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 12px; padding: 30px; margin: 40px 0; border-left: 4px solid #3b82f6; border: 1px solid #bfdbfe;">
                        <div style="font-size: 20px; font-weight: 700; margin-bottom: 8px; color: #2563ea; display: flex; align-items: center; justify-content: center; gap: 12px;">
                            Getting Started with {company_name}
                        </div>
                        <div style="font-size: 14px; color: #000000; font-weight: 500; margin-bottom: 25px; line-height: 1.5; text-align: center;">
                            Follow the provided simple steps to activate the Snipers for your account.
                        </div>
                        <ul style="list-style: none; padding: 0; margin: 0;">
                            <li style="padding: 16px 0 16px 40px; border-bottom: 1px solid rgba(59, 130, 246, 0.1); font-size: 16px; color: #374151; font-weight: 500; position: relative;">
                                <strong>New here and haven't signed up via referral?</strong><br>
                                👉 Fill out this quick form to register: 
                                <a href="https://docs.google.com/forms/d/e/1FAIpQLSd9YLlh8fy0oRhTxco1gVIOhKkBpzrollp1PsQVePAQGEdLkg/viewform" target="_blank" style="color: #2563eb; text-decoration: none;">Click here</a>
                            </li>
                            <li style="padding: 16px 0 16px 40px; border-bottom: 1px solid rgba(59, 130, 246, 0.1); font-size: 16px; color: #374151; font-weight: 500; position: relative;">
                                <strong>Add your Broker</strong><br>
                                🔗 Add your broker using the User Id, API and Secret API key from your Delta Exchange account – our current exchange partner.
                            </li>
                            <li style="padding: 16px 0 16px 40px; border-bottom: 1px solid rgba(59, 130, 246, 0.1); font-size: 16px; color: #374151; font-weight: 500; position: relative;">
                                <strong>Approval Process</strong><br>
                                ⏳ Once you've added your account, please wait for approval from our team. Once approved, you will receive an approval mail from our end.
                            </li>
                            <li style="padding: 16px 0 16px 40px; border-bottom: 1px solid rgba(59, 130, 246, 0.1); font-size: 16px; color: #374151; font-weight: 500; position: relative;">
                                <strong>Deploy a Strategy</strong><br>
                                📈 After approval, choose and deploy the trading strategy that best fits your goals.
                            </li>
                            <li style="padding: 16px 0 16px 40px; font-size: 16px; color: #374151; font-weight: 500; position: relative;">
                                <strong>Minimum Capital Requirement</strong><br>
                                💰 Each strategy needs a minimum of $500 or ₹50,000 to begin.
                            </li>
                        </ul>
                    </div>
                    
                    <!-- Let the Sniper Take Over Section -->
                    <div style="margin: 50px 0 40px 0;">
                        <div style="background: #2563ea; border-radius: 12px; padding: 35px 30px; text-align: center; color: #ffffff;">
                            <div style="font-size: 20px; margin-bottom: 12px; font-weight: 600; line-height: 1.4;">
                                Let the Sniper Take Over
                            </div>
                            <div style="font-size: 16px; font-weight: 500; opacity: 0.95; line-height: 1.6;">
                                🎯 Sit back and relax while the Snipers execute trades for you, 24/7!
                            </div>
                        </div>
                    </div>
                    
                    <!-- Expert Support Section -->
                    <div style="margin: 50px 0 40px 0;">
                        <div style="background: #f8fafc; border-radius: 12px; padding: 40px 30px; text-align: center; border: 1px solid #e2e8f0;">
                            <div style="font-size: 22px; font-weight: 700; margin-bottom: 18px; color: #2563ea; line-height: 1.3;">
                                Expert Support Available
                            </div>
                            <div style="color: #000000; font-weight: 500; margin: 0 auto 30px auto; font-size: 16px; line-height: 1.6; max-width: 500px;">
                                If you need help or have questions, don't hesitate to reach out. We're here to help you win in the markets.
                            </div>
                        <div style="display: flex; justify-content: center; gap: 80px; flex-wrap: wrap; margin: 30px 0 20px 0;">
                            <div style="text-align: center; margin: 0 20px 20px 20px; padding: 20px; background: #ffffff; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); min-width: 180px;">
                                <div style="font-size: 28px; margin-bottom: 12px;">✉️</div>
                                <div style="font-weight: 700; margin-bottom: 8px; font-size: 16px; color: #1e40af;">Email Support</div>
                                <div style="font-size: 14px; color: #4b5563; line-height: 1.5;">info@thecryptosnipers.com</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div style="text-align: center; padding: 30px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
                    <div style="font-size: 18px; font-weight: 600; margin-bottom: 10px; color: #1e293b;">
                        We're Excited to Have You Onboard!
                    </div>
                    <div style="font-size: 14px; color: #475569; margin-bottom: 15px;">
                        Your journey to automated trading success starts now.
                    </div>
                    <div style="font-size: 14px; color: #475569; margin-bottom: 20px;">
                        Let the algorithms do the work. <span style="font-size: 16px;">📈</span>
                    </div>
                    <div style="font-style: italic; color: #64748b; font-size: 14px; margin-top: 25px;">
                        Happy Trading,<br>
                        <span style="font-weight: 600;">The {company_name} Team</span>
                    </div>
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
                        <p>© {company_name} {time.strftime('%Y')}. All rights reserved.</p>
                        <p style="margin-top: 5px;">This is an automated message, please do not reply directly to this email.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """.format(company_name=company_name)

        # Add plain text part
        message.attach(MIMEText(text, "plain"))
        
        # Add HTML part with image reference
        html_part = MIMEText(html, 'html')
        message.attach(html_part)
        
        # Add image as an inline attachment if logo path is provided
        if logo_path and os.path.exists(logo_path):
            with open(logo_path, 'rb') as img_file:
                img_data = img_file.read()
                
            # Create the image part
            img = MIMEImage(img_data, name=os.path.basename(logo_path))
            img.add_header('Content-ID', '<logo>')
            img.add_header('Content-Disposition', 'inline', filename=os.path.basename(logo_path))
            message.attach(img)
            
            # Update the HTML to reference the attached image
            message.get_payload()[-1].set_payload(
                message.get_payload()[-1].get_payload()
                .replace('src="data:image/png;base64,{logo_base64}"', 'src="cid:logo"')
            )

        # Create secure connection with server and send email
        context = ssl.create_default_context()
        
        logger.info(f"Attempting to send welcome email to {recipient_email} via {smtp_server}:{smtp_port}")
        if smtp_port == 465:  # SSL port
            with smtplib.SMTP_SSL(smtp_server, smtp_port, context=context) as server:
                server.login(sender_email, sender_password)
                server.sendmail(sender_email, recipient_email, message.as_string())
                logger.info(f"Welcome email sent successfully to {recipient_email} using SSL")
        elif smtp_port == 587:  # STARTTLS port
            with smtplib.SMTP(smtp_server, smtp_port) as server:
                server.starttls(context=context)
                server.login(sender_email, sender_password)
                server.sendmail(sender_email, recipient_email, message.as_string())
                logger.info(f"Welcome email sent successfully to {recipient_email} using STARTTLS")
        else:
            error_msg = f"Unsupported SMTP port: {smtp_port}. Use 465 (SSL) or 587 (STARTTLS)."
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        return True
        
    except Exception as e:
        logger.error(f"Error sending welcome email to {recipient_email}: {str(e)}", exc_info=True)
        return False


def send_approval_email(sender_email: str=your_email_address, sender_password: str=your_email_password, recipient_email: str=recipient_email_address,
                      smtp_server: str=your_smtp_server, smtp_port: int=your_smtp_port, company_name: str=your_company_name,
                      logo_path: str=logo_path) -> bool:
    """
    Send an account approval email to the user with styles from index_approval.html and styles_approval.css.
    
    Args:
        sender_email (str): Email address of the sender.
        sender_password (str): Password for the sender's email.
        recipient_email (str): Email address of the recipient.
        smtp_server (str): SMTP server address.
        smtp_port (int): SMTP server port.
        company_name (str): Name of the company.
        logo_path (str, optional): Path to the logo image file. Defaults to None.
        
    Returns:
        bool: True if email was sent successfully, False otherwise.
    """
    try:
        logger.info(f"Preparing approval email for {recipient_email}")
        message = MIMEMultipart("alternative")
        message["Subject"] = "Your Account is Now Approved!"
        message["From"] = formataddr((company_name, sender_email))
        message["To"] = recipient_email

        # Plain-text version
        text = f"""
        Your Account is Now Approved!

        We’re pleased to inform you that your account on {company_name} has been successfully approved.

        What’s Next?
        To help you get started, please find the onboarding video and guidelines linked below:
        🔗 Guide Link.

        - How to access and use the platform?
        - How to link your broker to the Crypto Snipers?
        - How to deploy your strategy?
        - How to deactivate your strategy?
        - How to check your trade history?

        Let the Sniper Take Over
        We’re excited to have you onboard, and we can’t wait to see your trading journey take off with us.

        Expert Support Available
        If you have any questions or face issues during onboarding, feel free to reply to this email or reach out to our support team on Telegram.

        Email Support: info@thecryptosnipers.com
        Telegram Support: @infocryptosnipers

        Happy Snipping,
        Team {company_name}
        © {company_name} {time.strftime('%Y')}. All rights reserved.
        """

        # HTML version with inlined CSS
        html = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to {company_name}</title>
        </head>
        <body style="margin: 0; padding: 20px; box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); color: #1e293b; line-height: 1.6;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); border: 1px solid #e2e8f0;">
                <div style="background: rgb(0, 0, 0); padding: 40px 30px; text-align: center; position: relative; overflow: hidden;">
                    <div style="margin-bottom: 15px;"><img style="height: 8rem; width: 20rem;" src="cid:logo" alt="cryptoSniperLogo"></div>
                    <div style="font-size: 18px; color: rgba(255, 255, 255, 0.9); position: relative; z-index: 2; font-weight: 400; letter-spacing: 0.5px;">The Crypto Snipers - Real Future of Trading begins here!</div>
                </div>
                
                <div style="padding: 50px 40px;">
                    <div style="font-size: 24px; font-weight: 600; margin-bottom: 20px; text-align: center; color: #2563ea; line-height: 1.3;">
                        Your Account is Now Approved!
                    </div>
                    <div style="font-size: 16px; font-weight: 500; text-align: center; color: #000000; margin-bottom: 40px;">
                        We’re pleased to inform you that your account on The Crypto Snipers has been successfully approved. 
                    </div>
                    
                    <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 12px; padding: 30px; margin: 40px 0; border-left: 4px solid #3b82f6; border: 1px solid #bfdbfe;">
                        <div style="font-size: 20px; font-weight: 700; margin-bottom: 8px; color: #2563ea; display: flex; align-items: center; gap: 12px;">
                            <span>What’s Next?</span>
                        </div>
                        <div style="font-size: 14px; color: #000000; font-weight: 500; margin-bottom: 25px; line-height: 1.5;">
                            To help you get started, please find the onboarding video and guidelines linked below:
                            🔗 Guide Link.
                        </div>
                        <ul style="list-style: none; padding: 0;">
                            <li style="padding: 16px 0 16px 40px; border-bottom: 1px solid rgba(59, 130, 246, 0.1); font-size: 16px; color: #374151; font-weight: 500; position: relative; display: flex; align-items: center;">
                                <span style="color: #3b82f6; font-size: 16px; font-weight: bold; margin-right: 8px;">✓</span>
                                How to access and use the platform?
                            </li>
                            <li style="padding: 16px 0 16px 40px; border-bottom: 1px solid rgba(59, 130, 246, 0.1); font-size: 16px; color: #374151; font-weight: 500; position: relative; display: flex; align-items: center;">
                                <span style="color: #3b82f6; font-size: 16px; font-weight: bold; margin-right: 8px;">✓</span>
                                How to link your broker to the Crypto Snipers?
                            </li>
                            <li style="padding: 16px 0 16px 40px; border-bottom: 1px solid rgba(59, 130, 246, 0.1); font-size: 16px; color: #374151; font-weight: 500; position: relative; display: flex; align-items: center;">
                                <span style="color: #3b82f6; font-size: 16px; font-weight: bold; margin-right: 8px;">✓</span>
                                How to deploy your strategy?
                            </li>
                            <li style="padding: 16px 0 16px 40px; border-bottom: 1px solid rgba(59, 130, 246, 0.1); font-size: 16px; color: #374151; font-weight: 500; position: relative; display: flex; align-items: center;">
                                <span style="color: #3b82f6; font-size: 16px; font-weight: bold; margin-right: 8px;">✓</span>
                                How to deactivate your strategy?
                            </li>
                            <li style="padding: 16px 0 16px 40px; font-size: 16px; color: #374151; font-weight: 500; position: relative; display: flex; align-items: center;">
                                <span style="color: #3b82f6; font-size: 16px; font-weight: bold; margin-right: 8px;">✓</span>
                                How to check your trade history?
                            </li>
                        </ul>
                    </div>
                    
                    <div style="background: #2563ea; border-radius: 12px; padding: 30px; text-align: center; margin: 40px 0; color: #ffffff;">
                        <div style="font-size: 18px; margin-bottom: 8px; font-weight: 600;">
                            Let the Sniper Take Over
                        </div>
                        <div style="font-size: 14px; font-weight: 500; opacity: 0.9;">
                           We’re excited to have you onboard, and we can’t wait to see your trading journey take off with us.
                        </div>
                    </div>
                    
                    <div style="background: #f8fafc; border-radius: 12px; padding: 30px; margin: 40px 0; text-align: center; border: 1px solid #e2e8f0;">
                        <div style="font-size: 20px; font-weight: 700; margin-bottom: 12px; color: #2563ea;">Expert Support Available</div>
                        <div style="color: #000000; font-weight: 500; margin-bottom: 25px; font-size: 16px;">
                            If you have any questions or face issues during onboarding, feel free to reply to this email or reach out to our support team on Telegram.
                        </div>
                        <div style="display: flex; justify-content: center; gap: 40px; flex-wrap: wrap; margin-top: 20px;">
                            <div style="padding: 20px; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); margin: 10px; min-width: 200px;">
                                <div style="font-size: 28px; margin-bottom: 12px;">✉️</div>
                                <div style="font-weight: 700; margin-bottom: 8px; font-size: 16px; color: #1e40af;">Email Support</div>
                                <div style="font-size: 14px; color: #4b5563; line-height: 1.5;">
                                    <a style="color: #2563eb; text-decoration: none;"
                                    href="mailto:info@thecryptosnipers.com">info@thecryptosnipers.com</a>
                                </div>
                            </div>
                            <div style="padding: 20px; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); margin: 10px; min-width: 200px;">
                                <div style="font-size: 28px; margin-bottom: 12px;">💬</div>
                                <div style="font-weight: 700; margin-bottom: 8px; font-size: 16px; color: #1e40af;">Telegram Support</div>
                                <div style="font-size: 14px; color: #4b5563; line-height: 1.5;">
                                    <a style="color: #2563eb; text-decoration: none;"
                                    href="https://t.me/infocryptosnipers">@infocryptosnipers</a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div style="text-align: center; padding: 30px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
                    <div style="font-size: 18px; font-weight: 600; margin-bottom: 10px; color: #1e293b;">
                        We're Excited to Have You Onboard!
                    </div>
                    <div style="font-size: 14px; color: #475569; margin-bottom: 15px;">
                        Your journey to automated trading success starts now.
                    </div>
                    <div style="font-size: 14px; color: #475569; margin-bottom: 20px;">
                        Let the algorithms do the work. <span style="font-size: 16px;">📈</span>
                    </div>
                    <div style="font-style: italic; color: #64748b; font-size: 14px; margin-top: 25px;">
                        Happy Snipping,<br>
                        <span style="font-weight: 600;">Team {company_name}</span>
                    </div>
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
                        <p>© {company_name} {time.strftime('%Y')}. All rights reserved.</p>
                        <p style="margin-top: 5px;">This is an automated message, please do not reply directly to this email.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """.format(company_name=company_name)

        message.attach(MIMEText(text, "plain"))
        message.attach(MIMEText(html, "html"))

        if logo_path and os.path.exists(logo_path):
            with open(logo_path, 'rb') as img_file:
                img = MIMEImage(img_file.read())
                img.add_header('Content-ID', '<logo>')
                message.attach(img)

        context = ssl.create_default_context()
        logger.info(f"Attempting to send approval email to {recipient_email} via {smtp_server}:{smtp_port}")
        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_server, smtp_port, context=context) as server:
                server.login(sender_email, sender_password)
                server.sendmail(sender_email, recipient_email, message.as_string())
                logger.info(f"Approval email sent successfully to {recipient_email} using SSL")
        elif smtp_port == 587:
            with smtplib.SMTP(smtp_server, smtp_port) as server:
                server.starttls(context=context)
                server.login(sender_email, sender_password)
                server.sendmail(sender_email, recipient_email, message.as_string())
                logger.info(f"Approval email sent successfully to {recipient_email} using STARTTLS")
        else:
            error_msg = f"Unsupported SMTP port: {smtp_port}. Use 465 (SSL) or 587 (STARTTLS)."
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        logger.info(f"Approval email sent to {recipient_email}")
        return True
        
    except Exception as e:
        logger.error(f"Error sending approval email to {recipient_email}: {str(e)}", exc_info=True)
        return False


if __name__ == "__main__":
    
    logger.info("Starting EmailSender service")
    load_dotenv()
    
    MONGO_URI = os.getenv("MONGO_URL")
    MONGO_DB_NAME = os.getenv("MONGO_DB_NAME")
    if not MONGO_URI:
        logger.error("MONGO_URL environment variable not set")
        exit(1)
        
    logger.info("Connecting to MongoDB")
    client = pymongo.MongoClient(MONGO_URI)
    db = client[f"{MONGO_DB_NAME}"]
    users = db["users"]

    logger.info("Starting MongoDB change stream watcher")
    while True:
        try:
            logger.info("Watching for changes in users collection")
            with users.watch(full_document="updateLookup") as stream:
                for change in stream:

                    if change['operationType'] == 'insert':
                        user_email = change['fullDocument'].get('email')
                        user_id = change['fullDocument'].get('_id')
                        
                        if not user_email:
                            logger.warning(f"New document inserted without email field: {user_id}")
                            continue
                            
                        logger.info(f"New user registered with ID: {user_id}, sending welcome email to: {user_email}")

                        success = send_welcome_email(
                            sender_email=your_email_address,
                            sender_password=your_email_password,
                            recipient_email=user_email,
                            smtp_server=your_smtp_server,
                            smtp_port=your_smtp_port,
                            company_name=your_company_name,
                            logo_path=logo_path
                        )
                        
                        if success:
                            logger.info(f"Welcome email successfully sent to: {user_email}")
                        else:
                            logger.error(f"Failed to send welcome email to: {user_email}")

                    if change['operationType'] == 'update':

                        updated_fields = change['updateDescription']['updatedFields']

                        if "status" in updated_fields and updated_fields["status"] == "Approved":
                            user_email = change['fullDocument'].get('email')
                            user_id = change['fullDocument'].get('_id')
                            
                            if not user_email:
                                logger.warning(f"Updated document without email field: {user_id}")
                                continue
                                
                            logger.info(f"User account approved with ID: {user_id}, sending approval email to: {user_email}")

                            success = send_approval_email(
                                sender_email=your_email_address,
                                sender_password=your_email_password,
                                recipient_email=user_email,
                                smtp_server=your_smtp_server,
                                smtp_port=your_smtp_port,
                                company_name=your_company_name,
                                logo_path=logo_path
                            )
                            
                            if success:
                                logger.info(f"Approval email successfully sent to: {user_email}")
                            else:
                                logger.error(f"Failed to send approval email to: {user_email}")
        except pymongo.errors.PyMongoError as e:
            logger.error(f"MongoDB error in watch stream: {str(e)}", exc_info=True)
            time.sleep(5)  # Wait before reconnecting
            continue
        except Exception as e:
            logger.error(f"Unexpected error in watch stream: {str(e)}", exc_info=True)
            time.sleep(5)  # Wait before reconnecting
            continue
        
    # Email configuration
    # your_email_address = "vipinpal.dev@gmail.com"
    # your_email_password = "rzqr mlqi vniq qtve"
    # recipient_email_address = "vipinpal7080@gmail.com"
    # your_smtp_server = "smtp.gmail.com"
    # your_smtp_port = 587
    # your_company_name = "Crypto Snipers"

    # your_email_address = "support@thecryptosnipers.com"
    # your_email_password = "Manisha@ANG#13"
    # recipient_email_address = "vipinpal7060@gmail.com"
    # your_smtp_server = "smtpout.secureserver.net"
    # your_smtp_port = 465
    # your_company_name = "Crypto Snipers"

    # Path to your logo (relative to the script location)
    # logo_path = os.path.join(os.path.dirname(__file__), "assets", "CS2.png")
    
    # Send the welcome email with embedded logo
    # send_welcome_email(
    #     sender_email=your_email_address,
    #     sender_password=your_email_password,
    #     recipient_email=recipient_email_address,
    #     smtp_server=your_smtp_server,
    #     smtp_port=your_smtp_port,
    #     company_name=your_company_name,
    #     logo_path=logo_path
    # )

    # send_approval_email(
    #     sender_email=your_email_address,
    #     sender_password=your_email_password,
    #     recipient_email=recipient_email_address,
    #     smtp_server=your_smtp_server,
    #     smtp_port=your_smtp_port,
    #     company_name=your_company_name,
    #     logo_path=logo_path
    # )

    # """

    # # Instead of:
    # html = """... 👉 Fill out this quick form ..."""

    # # Use:
    # html = """... <img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f449.png" 
    # alt="👉" style="height: 1em; width: 1em; vertical-align: -0.1em;"> Fill out this quick form ..."""

    # Common Emoji Code Points:
    # 👉 Pointing finger: 1f449
    # 🔗 Link: 1f517
    # ⏳ Hourglass: 23f3
    # 💰 Money bag: 1f4b0
    # 📈 Chart increasing: 1f4c8
    # ✉️ Envelope: 2709-fe0f
    # 💬 Speech balloon: 1f4ac
    # ✔ Check: 2705-fe0f
    # <a href="https://www.flaticon.com/free-icons/foursquare-check-in" title="foursquare check in icons"></a>

    # """
    
