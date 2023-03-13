const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../config/config.env') });
const MongooseConnection = require('../server/db/connection');
const { allUsers, wishcards, agency } = require('./seederData');
const User = require('../server/db/models/User');
const WishCard = require('../server/db/models/WishCard');
const Agency = require('../server/db/models/Agency');
const Message = require('../server/db/models/Message');
const Donation = require('../server/db/models/Donation');
const { getMessageChoices } = require('../server/helper/defaultMessages');
const log = require('../server/helper/logger');

(async () => {
	const mongooseConnection = new MongooseConnection();
	try {
		if (process.env.NODE_ENV === 'development') {
			mongooseConnection.connect();

			const createWishCard = async (partnerId, createdAgency, card) => {
				await WishCard.create({
					...card,
					childFirstName: `${card.childFirstName}-${
						card.status
					}-${card.createdAt.toDateString()}`,
					createdBy: partnerId,
					belongsTo: createdAgency._id,
				});
			};

			const createDonation = async (donorId, agencyId, card) => {
				const statusChoices = ['confirmed', 'ordered', 'delivered'];
				// eslint-disable-next-line no-bitwise
				const newStatus = statusChoices[(statusChoices.length * Math.random()) | 0];
				await Donation.create({
					donationFrom: donorId,
					donationTo: agencyId,
					donationCard: card._id,
					donationPrice: card.wishItemPrice,

					status: newStatus,
				});
			};

			const createMessage = async (donor, card) => {
				const allMessages = getMessageChoices(donor.fName, card.childFirstName);
				// eslint-disable-next-line no-bitwise
				const message = allMessages[(allMessages.length * Math.random()) | 0];
				await Message.create({
					messageFrom: donor._id,
					messageTo: card._id,
					// eslint-disable-next-line no-undef
					message,
				});
			};

			const createRecords = async () => {
				const { donorUser, partnerUser, adminUser } = allUsers;
				await User.insertMany([adminUser, partnerUser]);
				const donor = await User.create(donorUser);
				const partnerUserId = await User.findOne({ email: partnerUser.email })
					.select('_id')
					.lean()
					.exec();
				const createdAgency = await Agency.create({
					...agency,
					accountManager: partnerUserId,
				});
				await Promise.all(
					wishcards.map(async (card) => {
						await createWishCard(partnerUserId, createdAgency, card);
					}),
				);
				const donatedCards = await WishCard.find({ status: 'donated' });
				await Promise.all(
					donatedCards.map(async (donatedCard) => {
						await createDonation(donor._id, createdAgency, donatedCard);
					}),
				);

				const allCards = await WishCard.find({});
				await Promise.all(
					allCards.map(async (card) => {
						await createMessage(donor, card);
					}),
				);
			};

			const insertData = async () => {
				await createRecords();
			};

			const deleteDataAndImport = async () => {
				await Agency.deleteMany();
				await User.deleteMany();
				await WishCard.deleteMany();
				await Message.deleteMany();
				await Donation.deleteMany();

				await createRecords();
			};

			const destroyData = async () => {
				await Agency.deleteMany();
				await User.deleteMany();
				await WishCard.deleteMany();
				await Message.deleteMany();
				await Donation.deleteMany();
			};

			if (process.argv[2] === '-d') {
				log.info('calling destroyData, purging db');
				await destroyData();
			} else if (process.argv[2] === '-i') {
				log.info('calling insertData, inserting new entries');
				await insertData();
			} else {
				log.info('calling deleteDataAndImport, purging db and inserting new entries');
				await deleteDataAndImport();
			}
		}
	} catch (error) {
		log.error(error);
		await mongooseConnection.disconnect();
	} finally {
		await mongooseConnection.disconnect();
	}
})();
