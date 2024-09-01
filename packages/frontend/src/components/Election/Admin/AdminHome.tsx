import React, { useContext } from 'react'
import Grid from "@mui/material/Grid";
import { Box, Divider, Paper } from "@mui/material";
import { Typography } from "@mui/material";
import { StyledButton } from "../../styles";
import { Link, useNavigate } from 'react-router-dom';
import { Election } from '@equal-vote/star-vote-shared/domain_model/Election';
import ShareButton from "../ShareButton";
import { useArchiveEleciton, useFinalizeElection, usePostElection, useSetPublicResults } from "../../../hooks/useAPI";
import { useSubstitutedTranslation } from '../../util';
import useConfirm from '../../ConfirmationDialogProvider';
import useElection from '../../ElectionContextProvider';
import ElectionDetailsInlineForm from '../../ElectionForm/Details/ElectionDetailsInlineForm';
import Races from '../../ElectionForm/Races/Races';
import ElectionSettings from '../../ElectionForm/ElectionSettings';
import structuredClone from '@ungap/structured-clone';
import useAuthSession from '../../AuthSessionContextProvider';
import useFeatureFlags from '../../FeatureFlagContextProvider';
import ElectionAuthForm from '~/components/ElectionForm/Details/ElectionAuthForm';

type SectionProps = {
    text: {[key: string]: string}
    button: any
    permission?: string
    includeDivider?: boolean
}

const AdminHome = () => {
    const authSession = useAuthSession()
    const { election, refreshElection: fetchElection, permissions } = useElection()
    const {t} = useSubstitutedTranslation(election.settings.term_type, {time_zone: election.settings.time_zone});
    const { makeRequest } = useSetPublicResults(election.election_id)
    const togglePublicResults = async () => {
        const public_results = !election.settings.public_results
        await makeRequest({ public_results: public_results })
        await fetchElection()
    }
    const { makeRequest: finalize } = useFinalizeElection(election.election_id)
    const { makeRequest: archive } = useArchiveEleciton(election.election_id)

    const navigate = useNavigate()
    const { error, isPending, makeRequest: postElection } = usePostElection()
    
    const confirm = useConfirm()

    const hasPermission = (requiredPermission: string) => {
        return (permissions && permissions.includes(requiredPermission))
    }

    const finalizeElection = async () => {
        const confirmed = await confirm(t('admin_home.finalize_confirm'))
        if (!confirmed) return
        try {
            await finalize()
            await fetchElection()
        } catch (err) {
            console.error(err)
        }
    }

    const archiveElection = async () => {
        const confirmed = await confirm(t('admin_home.finalize_confirm'))
        if (!confirmed) return
        try {
            await archive()
            await fetchElection()
        } catch (err) {
            console.error(err)
        }
    }

    const duplicateElection = async () => {
        const confirmed = await confirm(t('admin_home.duplicate_confirm'))
        if (!confirmed) return
        const copiedElection = structuredClone(election)
        copiedElection.title = t('admin_home.copied_title', {title: copiedElection.title})
        copiedElection.frontend_url = ''
        copiedElection.owner_id = authSession.getIdField('sub')
        copiedElection.state = 'draft'

        const newElection = await postElection(
            {
                Election: copiedElection,
            })

        if ((!newElection)) {
            throw Error("Error submitting election");
        }
        navigate(`/${newElection.election.election_id}/admin`)
    }

    const Section = ({ text, button, permission, includeDivider=true }: SectionProps) => 
        <Grid container sx={{ maxWidth: 800}}>
            <Grid xs={12} md={8} sx={{ p: 1 }}>
                <Box sx={{ minHeight: { xs: 0, md: 60 } }}>
                    <Typography variant="h5">
                        {text.description}
                    </Typography>
                    {text.subtext && 
                        <Typography variant="body1" sx={{ pl: 2 }}>
                            {text.subtext}
                        </Typography>
                    }
                    {permission && !hasPermission(permission) &&
                        <Typography align='center' variant="body1" sx={{ color: 'error.main', pl: 2 }}>
                            {t('admin_home.permissions_error')}
                        </Typography>
                    }
                </Box>
            </Grid>
            <Grid xs={12} md={4} sx={{ p: 1, pl: 2, display: 'flex', alignItems: 'center' }}>
                {button}
            </Grid>
            {includeDivider && <Divider style={{width: '100%'}}/>}
        </Grid>

    const EditRolesSection = () => <Section
        text={t('admin_home.roles')}
        permission='canEditElectionRoles'
        button={(<>
            <StyledButton
                variant='contained'
                disabled={!hasPermission('canEditElectionRoles')}
                fullwidth
                component={Link} to={`/${election.election_id}/admin/roles`}
            >
                {t('admin_home.roles.button')}
            </StyledButton>
        </>)}
    />

    const TestBallotSection = () => <Section
        text={t('admin_home.test_ballot')}
        permission='canViewElectionRoll'
        button={(<>
            <StyledButton
                type='button'
                variant='contained'
                fullwidth
                component={Link} to={`/${election.election_id}`}
            >
                {t('admin_home.test_ballot.button')}
            </StyledButton>
        </>)}
    />

    const DuplicateElectionSection = () => <Section
        text={t('admin_home.duplicate')}
        button={
            <StyledButton
                type='button'
                variant='contained'
                disabled={!hasPermission('canEditElectionState')}
                fullwidth
                onClick={() => duplicateElection()}
            >
                {t('admin_home.duplicate.button')}
            </StyledButton>
        }
    />

    const ResultsSection = () => <Section
        text={t('admin_home.view_results')}
        permission='canViewPreliminaryResults'
        button={(<>
            
        </>)}
    />

    const TogglePublicResultsSection = () => {
        let m = t('admin_home.public_results');
        let text = {
            ...m,
            description: election.settings.public_results === true ? m.make_private : m.make_public
        };
        return <Section
            text={text}
            permission='canEditElectionState'
            button={(<>
                <StyledButton
                    type='button'
                    variant='contained'
                    disabled={!hasPermission('canEditElectionState')}
                    fullwidth
                    onClick={togglePublicResults}
                >
                    {text.description}
                </StyledButton>
            </>)}
        />
    }

    const ArchiveElectionSection = () => <Section
        text={t('admin_home.archive')}
        permission='canEditElectionState'
        includeDivider={false}
        button={(<>
            <StyledButton
                type='button'
                variant='contained'
                disabled={!hasPermission('canEditElectionState')}
                fullwidth
                onClick={() => archiveElection()}
            >
                {t('admin_home.archive.button')}
            </StyledButton>
        </>)}
    />

    const HeaderSection = () => {
        return <Box width='100%'>
            {(election.state === 'open' || election.state == 'finalized') && election.settings.invitation &&
                <Typography align='center' gutterBottom variant="h6" component="h6">
                    {t('admin_home.header_invitations_sent')}
                </Typography>
            }
            {election.state === 'finalized' && election.start_time &&
                <Typography align='center' gutterBottom variant="h6" component="h6">
                    {t('admin_home.header_start_time', {datetime: election.start_time})}
                </Typography>
            }
            {election.state === 'open' && election.end_time &&
                <Typography align='center' gutterBottom variant="h6" component="h6">
                    {t('admin_home.header_end_time', {datetime: election.end_time})}
                </Typography>
            }
            {election.state === 'closed' && election.end_time && 
                <Typography align='center' gutterBottom variant="h6" component="h6">
                    {t('admin_home.header_ended_time', {datetime: election.end_time})}
                </Typography>
            }
            {election.state === 'archived' && election.end_time &&
                <Typography align='center' gutterBottom variant="h6" component="h6">
                    {t('admin_home.header_ended_time', {datetime: election.end_time})}
                </Typography>
            }
        </Box>
    }

    const FinalizeSection = () => <Box sx={{maxWidth: 800}}>
        <Grid xs={12} sx={{ p: 1, pt: 3, pb: 0 }}>
            <Typography align='center' variant="body1" sx={{ pl: 2 }}>
                {t('admin_home.finalize_description')}
                {t(election.start_time? 'admin_home.finalize_voting_begins_later' : 'admin_home.finalize_voting_begins_now')}
            </Typography>
            {election.settings.invitation &&
                <Typography align='center' variant="body1" sx={{ pl: 2 }}>
                   {t('admin_home.finalize_invitations_will_send')}
                </Typography>
            }
            {!hasPermission('canEditElectionState') &&
                <Typography align='center' variant="body1" sx={{ color: 'error.main', pl: 2 }}>
                    {t('admin_home.permissions_error')}
                </Typography>
            }
        </Grid>
        <Grid xs={12} sx={{ p: 1, pt: 0, display: 'flex', alignItems: 'center' }}>
            <StyledButton
                type='button'
                variant='contained'
                disabled={election.title.length === 0 || election.races.length === 0 || !hasPermission('canEditElectionState')}
                fullwidth
                onClick={() => finalizeElection()}
            >
                <Typography align='center' variant="h4" fontWeight={'bold'}>
                   {t('admin_home.finalize_button')}
                </Typography>
            </StyledButton>
        </Grid>
    </Box>
    
    const flags = useFeatureFlags();

    return <Box
        display='flex'
        justifyContent="center"
        alignItems="center"
        flexDirection='column'
        gap={6}
        sx={{ width: '100%', maxWidth: 800, margin: 'auto' }}
    >
        <HeaderSection />
        <ElectionDetailsInlineForm />
        {(election.state !== 'draft' && election.state !== 'finalized') && 
            <Box display='flex' sx={{flexDirection:{xs: 'column', sm: 'row'}}} alignItems='center' gap={2} justifyContent='space-evenly' width='100%'>
                <Box sx={{width: '100%', maxWidth: 300}}>
                    <ShareButton url={`${window.location.origin}/Election/${election.election_id}`} />
                </Box>
                <Box sx={{width: '100%', maxWidth: 300}}>
                    <StyledButton
                        type='button'
                        variant='contained'
                        disabled={!(hasPermission('canViewPreliminaryResults') || election.settings.public_results === true)}
                        fullwidth
                        component={Link} to={`/${election.election_id}/results`}
                    >
                        {t('admin_home.view_results.button')}
                    </StyledButton>
                </Box>
            </Box>
        }
        {(election.settings.voter_access === 'open') && <ElectionAuthForm />}
        <ElectionSettings />
        <Races />
        <Box sx={{width: '100%'}}>
            {(election.state === 'draft') && <TestBallotSection /> }
            {(election.state !== 'draft' && election.state !== 'finalized') && <TogglePublicResultsSection/>}
            {flags.isSet('ELECTION_ROLES') && <EditRolesSection />}
            <DuplicateElectionSection/>
            <ArchiveElectionSection />
        </Box>

        {election.state === 'draft' && <FinalizeSection /> }
    </Box>
}

export default AdminHome
