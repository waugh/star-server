import { ElectionRoll, ElectionRollState } from "../../../domain_model/ElectionRoll";
import ServiceLocator from "../ServiceLocator";
import Logger from "../Services/Logging/Logger";
import { responseErr } from "../Util";
import { Invites } from "../Services/Email/EmailTemplates"

const ElectionRollModel = ServiceLocator.electionRollDb();
const EmailService = ServiceLocator.emailService();
const className="VoterRolls.Controllers";

const getRollsByElectionID = async (req: any, res: any, next: any) => {
    const electionId = req.election.election_id;
    Logger.info(req, `${className}.getRollsByElectionID ${electionId}`);
    //requires election data in req, adds entire election roll 
    try {
        const electionRoll = await ElectionRollModel.getRollsByElectionID(electionId, req);
        if (!electionRoll) {
            const msg = `Election roll for ${electionId} not found`;
            Logger.info(req, msg);
            return responseErr(res, req, 400, msg);
        }
        
        Logger.debug(req, `Got Election: ${req.params.id}`, electionRoll);
        req.electionRoll = electionRoll
        return next()
    } catch (err:any) {
        const msg = `Could not retrieve election roll`;
        Logger.error(req, `${msg}: ${err.message}`);
        return responseErr(res, req, 500, msg);
    }
}

const addElectionRoll = async (req: any, res: any, next: any) => {
    Logger.info(req, `${className}.addElectionRoll ${req.election.election_id}`);
    try {
        const history = [{
            action_type: 'added',
            actor: req.user.email,
            timestamp: Date.now(),
        }]
        const rolls: ElectionRoll[] = req.body.VoterIDList.map((id:string) => ({
            election_id: req.election.election_id,
            voter_id: id,
            submitted: false,
            state: ElectionRollState.approved,
            history: history,
        }))
        const newElectionRoll = await ElectionRollModel.submitElectionRoll(rolls, req, `User adding Election Roll??`)
        if (!newElectionRoll){
            const msg= "Voter Roll not found";
            Logger.error(req, "= = = = = = \n = = = = = ");
            Logger.info(req, msg);
            return responseErr(res, req, 400, msg);
        }
        
        res.status('200').json({ election: req.election, newElectionRoll });
        return next()
    } catch (err:any) {
        const msg = `Could not add Election Roll`;
        Logger.error(req, `${msg}: ${err.message}`);
        return responseErr(res, req, 500, msg);
    }
}

const registerVoter = async (req: any, res: any, next: any) => {
    Logger.info(req, `${className}.registerVoter ${req.election.election_id}`);
    if (req.electionRollEntry?.registration){
        const msg= "Voter already registered";
        Logger.info(req, msg);
        return responseErr(res, req, 400, msg);}
    try {
        const history = [{
            action_type: 'registered',
            actor: req.user.email,
            timestamp: Date.now(),
        }]
        const roll:ElectionRoll[]= [{
            election_roll_id: '',
            election_id: req.election.election_id,
            voter_id: req.voter_id,
            submitted: false,
            state: ElectionRollState.registered,
            history: history,
            registration: req.body.registration,
        }] 
        const NewElectionRoll = await ElectionRollModel.submitElectionRoll(roll, req, 'User Registered')
        if (!NewElectionRoll){
            const msg= "Voter Roll not found";
            Logger.info(req, msg);
            return responseErr(res, req, 400, msg);
        }
        
        res.status('200').json(JSON.stringify({ election: req.election, NewElectionRoll }))
        return next()
    } catch (err:any) {
        const msg = `Could not add Election Roll`;
        Logger.error(req, `${msg}: ${err.message}`);
        return responseErr(res, req, 500, msg);
    }
}

const updateElectionRoll = async (req: any, res: any, next: any) => {
    const electinoRollInput = req.electionRollEntry;
    Logger.info(req, `${className}.updateElectionRoll`, {electionRollEntry: electinoRollInput});

    // Updates single entry of election roll
    if (req.election.settings.voter_id_type === 'None') {
        Logger.debug(req, "voter_id_type is None");
        return next();
    }
    try {
        const electionRollEntry = await ElectionRollModel.update(electinoRollInput, req, `User Updating Election Roll`)
        if (!electionRollEntry){
                const msg= "Voter Roll not found";
                Logger.info(req, msg);
                return responseErr(res, req, 400, msg);
        }
        req.electionRollEntry = electionRollEntry
        return next();
    } catch (err:any) {
        const msg = `Could not update Election Roll`;
        Logger.error(req, `${msg}: ${err.message}`);
        return responseErr(res, req, 500, msg);
    }
}

const getVoterAuth = async (req: any, res: any, next: any) => {
    Logger.info(req, `${className}.getVoterAuth`);
    const voterIdType = req.election.settings.voter_id_type;
    Logger.debug(req, `ID type: ${voterIdType}`);
    if (voterIdType === 'None') {
        req.authorized_voter = true
        req.has_voted = false
        req.electionRollEntry = {}
        return next()
    } else if (voterIdType === 'IP Address') {
        Logger.debug(req, `ip=${String(req.ip)}`);
        req.voter_id = String(req.ip)
    } else if (voterIdType === 'Email') {
        // If user isn't logged in, send response requesting log in
        if (!req.user) {
            return res.json({
                voterAuth: {
                    authorized_voter: false,
                    required: "Log In"
                }
            })
        }
        req.voter_id = req.user.email
    } else if (voterIdType === 'IDs') {
        // If voter ID not set, send response requesting voter ID to be entered
        if (!req.cookies.voter_id) {
            return res.json({
                voterAuth: {
                    authorized_voter: false,
                    required: "Voter ID"
                }
            })
        }
        req.voter_id = req.cookies.voter_id
    }
    try {
        const electionRollEntry = await ElectionRollModel.getByVoterID(req.election.election_id, req.voter_id, req);
        req.electionRollEntry = electionRollEntry
    } catch (err:any) {
        const msg = `Could not find election roll entry`;
        Logger.error(req, `${msg}: ${err.message}`);
        return responseErr(res, req, 500, msg);
    }
    if (req.election.settings.election_roll_type === 'None') {
        req.authorized_voter = true;
        if (req.electionRollEntry == null) {
            //Adds voter to roll if they aren't currently
            const history = [{
                action_type: ElectionRollState.approved,
                actor: req.user?.email || req.voter_id,
                timestamp: Date.now(),
            }]
            const roll:ElectionRoll[]= [{
                election_roll_id: '',
                election_id: req.election.election_id,
                voter_id: req.voter_id,
                submitted: false,
                state: ElectionRollState.approved,
                history: history,
            }]
            const newElectionRoll = await ElectionRollModel.submitElectionRoll(roll, req, `User requesting Roll and is authorized`)

            if (!newElectionRoll){
                const msg= "Voter Roll not found";
                Logger.info(req, msg);
                return responseErr(res, req, 400, msg);
            }
            req.electionRollEntry = newElectionRoll
            req.has_voted = false
            return next()
        } else {
            req.has_voted = req.electionRollEntry.submitted
            return next()
        }
    } else if (req.election.settings.election_roll_type === 'Email' || req.election.settings.election_roll_type === 'IDs') {
        if (req.electionRollEntry == null) {
            req.authorized_voter = false;
            req.has_voted = false
            return next()
        } else {
            req.authorized_voter = true
            req.has_voted = req.electionRollEntry.submitted
            return next()
        }
    }
}

const sendInvitations = async (req: any, res: any, next: any) => {
    //requires election data in req, adds entire election roll 
    if (req.election.settings.election_roll_type === 'Email') {
        Logger.info(req, `${className}.sendInvitations`, {election_id: req.election.election_id});
        try {
            const url = req.protocol + '://'+req.get('host')
            const invites = Invites(req.election,req.electionRoll,url)
            EmailService.sendEmails(invites)
        } catch (err:any) {
            const msg = `Could not send invitations`;
            Logger.error(req, `${msg}: ${err.message}`);
            return responseErr(res, req, 500, msg);
        }
    }
    return res.json({ election: req.election })
}

module.exports = {
    updateElectionRoll,
    getRollsByElectionID,
    addElectionRoll,
    getVoterAuth,
    sendInvitations,
    registerVoter
}
