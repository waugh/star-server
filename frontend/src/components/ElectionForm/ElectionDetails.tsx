import React from 'react'
import { useState } from "react"
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import FormControl from "@mui/material/FormControl";
import { FormHelperText, InputLabel, MenuItem, Select } from "@mui/material"
import { StyledButton } from '../styles';
import { Input } from '@mui/material';
import { DateTime } from 'luxon'
import { timeZones } from './TimeZones'
import { useLocalStorage } from '../../hooks/useLocalStorage';
export default function ElectionDetails({ election, applyElectionUpdate, getStyle, setPageNumber }) {

    const [errors, setErrors] = useState({
        title: '',
        description: '',
        startTime: '',
        endTime: '',
    })

    const [timeZone, setTimeZone] = useLocalStorage('timezone',DateTime.now().zone.name)

    const isValidDate = (d) => {
        if (d instanceof Date) return !isNaN(d.valueOf())
        if (typeof(d) === 'string')  return !isNaN(new Date(d).valueOf())
        return false
    }
    const validatePage = () => {
        let isValid = 1
        let newErrors = { ...errors }

        if (!election.title) {
            newErrors.title = 'Election title required';
            isValid = 0;
        }
        else if (election.title.length < 3 || election.title.length > 256) {
            newErrors.title = 'Election title must be between 3 and 256 characters';
            isValid = 0;
        }
        if (election.description.length > 1000) {
            newErrors.description = 'Description must be less than 1000 characters';
            isValid = 0;
        }
        if (election.start_time) {
            if (!isValidDate(election.start_time)) {
                newErrors.startTime = 'Invalid date';
                isValid = 0;
            }
            else if (election.start_time < new Date()) {
                newErrors.startTime = 'Start date must be in the future';
                isValid = 0;
            }
        }

        if (election.end_time) {
            if (!isValidDate(election.end_time)) {
                newErrors.endTime = 'Invalid date';
                isValid = 0;
            }
            else if (election.end_time < new Date()) {
                newErrors.endTime = 'Start date must be in the future';
                isValid = 0;
            }
            else if (election.start_time && newErrors.startTime === '') {
                // If start date exists, has no errors, and is after the end date
                if (election.start_time >= election.end_time) {
                    newErrors.endTime = 'End date must be after the start date';
                    isValid = 0;
                }
            }
        }
        setErrors(errors => ({ ...errors, ...newErrors }))
        return isValid
    }

    return (
        <>
            <Grid item xs={12} sx={{ m: 0, p: 1 }}>
                <TextField
                    inputProps={{ pattern: "[a-z]{1,15}" }}
                    error={errors.title !== ''}
                    required
                    id="election-name"
                    name="name"
                    // TODO: This bolding method only works for the text fields, if we like it we should figure out a way to add it to other fields as well
                    // inputProps={getStyle('title')}
                    label="Election Title"
                    type="text"
                    value={election.title}
                    sx={{
                        m: 0,
                        p: 0,
                        boxShadow: 2,
                    }}
                    fullWidth
                    onChange={(e) => {
                        setErrors({ ...errors, title: '' })
                        applyElectionUpdate(election => { election.title = e.target.value })
                    }}
                />
                <FormHelperText error sx={{ pl: 1, pt: 0 }}>
                    {errors.title}
                </FormHelperText>
            </Grid>
            <Grid item xs={12} sx={{ m: 0, p: 1 }}>
                <TextField
                    id="election-description"
                    name="description"
                    label="Description"
                    multiline
                    fullWidth
                    type="text"
                    error={errors.description !== ''}
                    value={election.description}
                    sx={{
                        mx: { xs: 0, },
                        my: { xs: 0 },
                        boxShadow: 2,
                    }}
                    onChange={(e) => {
                        setErrors({ ...errors, description: '' })
                        applyElectionUpdate(election => { election.description = e.target.value })
                    }}
                />
                <FormHelperText error sx={{ pl: 1, pt: 0 }}>
                    {errors.description}
                </FormHelperText>
            </Grid>            
            <Grid item xs={4} sx={{ m: 0, p: 1 }} justifyContent='center'>
                <FormControl fullWidth>
                    <InputLabel id="demo-simple-select-label">Time Zone</InputLabel>
                    <Select
                        labelId="demo-simple-select-label"
                        id="demo-simple-select"
                        value={timeZone}
                        label="Time Zone"
                        onChange={(e) => setTimeZone(e.target.value)}
                    >
                        <MenuItem value={timeZone}>{timeZone}</MenuItem>
                        {timeZones.map(tz =>
                            <MenuItem value={tz.ID}>{tz.name}</MenuItem>
                        )}
                    </Select>
                </FormControl>
            </Grid>
            <Grid item xs={8}></Grid>
            <Grid item xs={6} sx={{ m: 0, p: 1 }} justifyContent='center' >
                <FormControl fullWidth>
                    <InputLabel shrink>
                        Start Date
                    </InputLabel>
                    <Input
                        type='datetime-local'
                        error={errors.startTime !== ''}
                        value={DateTime.fromJSDate(election.start_time)
                            .setZone(timeZone)
                            .startOf("minute")
                            .toISO({ includeOffset: false, suppressSeconds: true, suppressMilliseconds: true })}
                        onChange={(e) => {
                            setErrors({ ...errors, startTime: '' })
                            applyElectionUpdate(election => 
                                election.start_time = DateTime.fromISO(e.target.value).setZone(timeZone,{keepLocalTime : true}).toJSDate())
                        }}
                    />
                    <FormHelperText error sx={{ pl: 0, mt: 0 }}>
                        {errors.startTime}
                    </FormHelperText>
                </FormControl>
            </Grid>
            <Grid item xs={6} sx={{ m: 0, p: 1 }} justifyContent='center'>
                <FormControl fullWidth>
                    <InputLabel shrink>
                        Stop Date
                    </InputLabel>
                    <Input
                        type='datetime-local'
                        error={errors.endTime !== ''}
                        value={DateTime.fromJSDate(election.end_time)
                            .setZone(timeZone)
                            .startOf("minute")
                            .toISO({ includeOffset: false, suppressSeconds: true, suppressMilliseconds: true })}
                        onChange={(e) => {
                            setErrors({ ...errors, endTime: '' })
                            applyElectionUpdate(election =>  
                                election.end_time = DateTime.fromISO(e.target.value).setZone(timeZone,{keepLocalTime : true}).toJSDate())
                        }}
                    />
                    <FormHelperText error sx={{ pl: 0, mt: 0 }}>
                        {errors.endTime}
                    </FormHelperText>
                </FormControl>
            </Grid>
            <Grid item xs={3} sx={{ m: 0, p: 1, pt: 2 }}>
                <StyledButton
                    type='button'
                    variant="contained"
                    width="100%"
                    disabled={true}
                    onClick={() => {
                        if (validatePage()) {
                            setPageNumber(pageNumber => pageNumber - 1)
                        }
                    }}>
                    Back
                </StyledButton>
            </Grid>
            <Grid item xs={6}></Grid>
            <Grid item xs={3} sx={{ m: 0, p: 1, pt: 2 }}>
                <StyledButton
                    type='button'
                    variant="contained"
                    fullWidth
                    onClick={() => {
                        if (validatePage()) {
                            setPageNumber(pageNumber => pageNumber + 1)
                        }
                    }}>
                    Next
                </StyledButton>
            </Grid>
        </>

    )
}
