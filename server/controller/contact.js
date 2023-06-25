const BaseController = require('./basecontroller');
const ContactRepository = require('../db/repository/ContactRepository');
const Messaging = require('../helper/messaging');

module.exports = class ContactController extends BaseController {
	#contactRepository;

	constructor() {
		super();
		this.#contactRepository = new ContactRepository();

		this.handleGetIndex = this.handleGetIndex.bind(this);
		this.handlePostEmail = this.handlePostEmail.bind(this);
		this.handlePostCustomerService = this.handlePostCustomerService.bind(this);
	}

	handleGetIndex(_req, res, _next) {
		this.renderView(res, 'contact');
	}

	async handlePostEmail(req, res, _next) {
		try {
			const contact = await this.#contactRepository.createNewContact({
				name: req.body.name,
				email: req.body.email,
				subject: `${req.body.subject} | send from ${req.body.name}`,
				message: req.body.message,
			});

			const mailResponse = await Messaging.sendMail(
				contact.email,
				'stacy.sealky.lee@gmail.com',
				contact.subject,
				contact.message,
			);

			if (mailResponse.error) {
				this.log.error({ ...req, ...mailResponse.error });
			} else {
				this.log.info('email successfully sent', req);
			}

			return res.status(201).redirect('/');
		} catch (error) {
			this.handleError({ res, code: 400, error: 'Failed to send Email!' });
		}
	}

	async handlePostCustomerService(req, res, _next) {
		const { name, email, subject, message } = req.body;
		const done = await Messaging.sendFeedbackMessage({ name, email, subject, message });

		if (done) {
			return res.status(200).send({
				success: true,
			});
		}

		return this.handleError({
			res,
			code: 400,
			error: 'Failed to send feedback! Please try again in a few minutes!',
		});
	}
};
