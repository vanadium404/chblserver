const express = require('express');
const soap = require('soap');
const cors = require('cors');

const stripe = require('stripe')('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');

const app = express();
const port = process.env.PORT || 3000;


const WEB_SERVICES = 'http://www.400hitter.com/ws/DataService.asmx?WSDL';
const ACCESS_KEY = '35b7746fba83414a89664c4daa93780b';




// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// POST /create-payment-intent
app.post('/create-payment-intent', async (req, res) => {
  const { amount } = req.body; // Amount to charge, sent from the frontend

  try {
    if (!amount) {
      return res.status(400).send({ error: 'Amount is required' });
    }

    // Create the payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Stripe expects the amount in cents
      currency: 'usd', // Set the currency (change if needed)
    });

    // Send the client secret to the frontend
    res.send({
      clientSecret: paymentIntent.client_secret, // Send the client secret back to the frontend
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);

    // Handle different types of errors:
    if (error.type === 'StripeCardError') {
      // This type of error happens when the card is declined or has insufficient funds
      res.status(400).send({
        error: 'Card declined or insufficient funds. Please check your card details and try again.',
      });
    } else if (error.type === 'StripeInvalidRequestError') {
      // Invalid request parameters
      res.status(400).send({
        error: 'Invalid request. Please check the payment details.',
      });
    } else if (error.type === 'StripeAPIError') {
      // Generic API error
      res.status(500).send({
        error: 'Stripe API error. Please try again later.',
      });
    } else {
      // Generic server error
      res.status(500).send({
        error: 'Internal Server Error. Please try again later.',
      });
    }
  }
});



// Helper function to fetch standings data from the SOAP service
async function getStandings(seasonID) {
  try {
    const soapClient = await soap.createClientAsync(WEB_SERVICES);

    const soapData = {
      key: ACCESS_KEY,
      SeasonID: seasonID,
      SeasonTypeID: "0"
    };

    const result = await soapClient.GetStandingsAsync(soapData);
    const standingsResult = result[0]?.GetStandingsResult;

    if (!standingsResult) {
      console.log('No standings data found.');
      return [];
    }

    const conference = standingsResult.Standings?.Conference;

    if (!conference || conference.length === 0) {
      console.log('No conferences or divisions found.');
      return [];
    }

    const updatedStandings = [];

    conference.forEach(conferenceItem => {
      conferenceItem.Division?.forEach(division => {
        division.Place?.forEach(place => {
          const teamName = place.Team?.attributes?.Name;
          const teamStats = {
            logo: "https://via.placeholder.com/40", // Placeholder for team logos
            team: teamName,
            Points: place.Points,
            W: place.W,
            L: place.L,
            T: place.T,
            RS: place.RS,
            RA: place.RA,
            Pct: place.Pct
          };
          updatedStandings.push(teamStats);
        });
      });
    });

    return updatedStandings;

  } catch (error) {
    console.error('Error fetching standings:', error.message || error);
    return [];
  }
}

// Helper function to fetch pitching ERA7 leaders
async function getPitchingERA7(seasonID) {
  try {
    const soapClient = await soap.createClientAsync(WEB_SERVICES);

    const soapData = {
      key: ACCESS_KEY,
      Category: "ERA7", // The category for ERA7 leaders
      SeasonID: seasonID,
      SeasonTypeID: "0"
    };

    const [result] = await soapClient.GetPitchingLeadersAsync(soapData);

    const pitchingLeadersResult = result?.GetPitchingLeadersResult;

    if (
      !pitchingLeadersResult ||
      !pitchingLeadersResult.Season ||
      !pitchingLeadersResult.Season.PitchingDataCollection ||
      !pitchingLeadersResult.Season.PitchingDataCollection.PitchingData
    ) {
      console.log('No pitching data found.');
      return [];
    }

    const pitchingData = pitchingLeadersResult.Season.PitchingDataCollection.PitchingData;

    const era7Data = pitchingData.map(player => ({
      playerName: `${player.Player?.attributes?.FirstName} ${player.Player?.attributes?.LastName}`,
      era7: player.ERA7
    })).slice(0, 5); // Get top 5 players

    console.log('Top 5 ERA7 Data:', JSON.stringify(era7Data, null, 2));
    return era7Data;

  } catch (error) {
    console.error('Error fetching pitching ERA7 leaders:', error.message || error);
    return [];
  }
}

async function getPitchingWHIP(seasonID) {
    try {
      const soapClient = await soap.createClientAsync(WEB_SERVICES);
  
      const soapData = {
        key: ACCESS_KEY,
        Category: "WHIP", // The category for WHIP leaders
        SeasonID: seasonID,
        SeasonTypeID: "0"
      };
  
      const [result] = await soapClient.GetPitchingLeadersAsync(soapData);
  
      const pitchingLeadersResult = result?.GetPitchingLeadersResult;
  
      if (
        !pitchingLeadersResult ||
        !pitchingLeadersResult.Season ||
        !pitchingLeadersResult.Season.PitchingDataCollection ||
        !pitchingLeadersResult.Season.PitchingDataCollection.PitchingData
      ) {
        console.log('No pitching data found.');
        return [];
      }
  
      const pitchingData = pitchingLeadersResult.Season.PitchingDataCollection.PitchingData;
  
      const whipData = pitchingData.map(player => ({
        playerName: `${player.Player?.attributes?.FirstName} ${player.Player?.attributes?.LastName}`,
        whip: player.WHIP
      })).slice(0, 5); // Get top 5 players
  
      console.log('Top 5 WHIP Data:', JSON.stringify(whipData, null, 2));
      return whipData;
  
    } catch (error) {
      console.error('Error fetching pitching WHIP leaders:', error.message || error);
      return [];
    }
  }

  async function getPitchingS(seasonID) {
    try {
      // Create the SOAP client
      const soapClient = await soap.createClientAsync(WEB_SERVICES);
  
      // Define the parameters for the SOAP request
      const soapData = {
        key: ACCESS_KEY,
        Category: "S", // Fetching by Saves
        SeasonID: seasonID,
        SeasonTypeID: "0"
      };
  
      // Make the SOAP request
      const [result] = await soapClient.GetPitchingLeadersAsync(soapData);
  
      // Extract and validate the result
      const pitchingLeadersResult = result?.GetPitchingLeadersResult;
      if (
        !pitchingLeadersResult ||
        !pitchingLeadersResult.Season ||
        !pitchingLeadersResult.Season.PitchingDataCollection ||
        !pitchingLeadersResult.Season.PitchingDataCollection.PitchingData
      ) {
        console.log('No pitching data found.');
        return [];
      }
  
      // Map and return the top 5 pitching data for Saves
      const pitchingData = pitchingLeadersResult.Season.PitchingDataCollection.PitchingData;
      const savesData = pitchingData.map(player => ({
        playerName: `${player.Player?.attributes?.FirstName} ${player.Player?.attributes?.LastName}`,
        saves: player.S
      })).slice(0, 5); // Limit to top 5
  
      console.log('Top 5 Saves Data:', JSON.stringify(savesData, null, 2));
      return savesData;
  
    } catch (error) {
      console.error('Error fetching pitching saves leaders:', error.message || error);
      return [];
    }
  }

  async function getBattingLeadersAVG(seasonID, category) {
    try {
      // Create the SOAP client
      const soapClient = await soap.createClientAsync(WEB_SERVICES);
  
      // Define the SOAP request parameters
      const soapData = {
        key: ACCESS_KEY,
        Category: category,
        SeasonID: seasonID,
        SeasonTypeID: "0"
      };
  
      // Make the SOAP request and await the response
      const [result] = await soapClient.GetBattingLeadersAsync(soapData);
  
      // Extract the result
      const battingLeadersResult = result?.GetBattingLeadersResult;
  
      if (
        !battingLeadersResult ||
        !battingLeadersResult.Season ||
        !battingLeadersResult.Season.BattingDataCollection ||
        !battingLeadersResult.Season.BattingDataCollection.BattingData
      ) {
        console.log('No batting data found.');
        return [];
      }
  
      // Extract the BattingData array
      const battingData = battingLeadersResult.Season.BattingDataCollection.BattingData;
  
      // Map the data into a more readable format
      const battingLeaders = battingData.map(player => ({
        playerName: `${player.Player?.attributes?.FirstName} ${player.Player?.attributes?.LastName}`,
        AVG: player.AVG // Extract the AVG field
      })).slice(0, 5);
  
      return battingLeaders;
    } catch (error) {
      console.error('Error fetching batting leaders:', error.message || error);
      return [];
    }
  }

  async function getBattingLeadersH(seasonID, category) {
    try {
      // Create the SOAP client
      const soapClient = await soap.createClientAsync(WEB_SERVICES);
  
      // Define the SOAP request parameters
      const soapData = {
        key: ACCESS_KEY,
        Category: category,
        SeasonID: seasonID,
        SeasonTypeID: "0"
      };
  
      // Make the SOAP request and await the response
      const [result] = await soapClient.GetBattingLeadersAsync(soapData);
  
      // Extract the result
      const battingLeadersResult = result?.GetBattingLeadersResult;
  
      if (
        !battingLeadersResult ||
        !battingLeadersResult.Season ||
        !battingLeadersResult.Season.BattingDataCollection ||
        !battingLeadersResult.Season.BattingDataCollection.BattingData
      ) {
        console.log('No batting data found.');
        return [];
      }
  
      // Extract the BattingData array
      const battingData = battingLeadersResult.Season.BattingDataCollection.BattingData;
  
      // Map the data into a more readable format
      const battingLeaders = battingData.map(player => ({
        playerName: `${player.Player?.attributes?.FirstName} ${player.Player?.attributes?.LastName}`,
        H: player.H // Extract the AVG field
      })).slice(0, 5);
  
      return battingLeaders;
    } catch (error) {
      console.error('Error fetching batting leaders:', error.message || error);
      return [];
    }
  }

  async function getBattingLeadersR(seasonID, category) {
    try {
      // Create the SOAP client
      const soapClient = await soap.createClientAsync(WEB_SERVICES);
  
      // Define the SOAP request parameters
      const soapData = {
        key: ACCESS_KEY,
        Category: category,
        SeasonID: seasonID,
        SeasonTypeID: "0"
      };
  
      // Make the SOAP request and await the response
      const [result] = await soapClient.GetBattingLeadersAsync(soapData);
  
      // Extract the result
      const battingLeadersResult = result?.GetBattingLeadersResult;
  
      if (
        !battingLeadersResult ||
        !battingLeadersResult.Season ||
        !battingLeadersResult.Season.BattingDataCollection ||
        !battingLeadersResult.Season.BattingDataCollection.BattingData
      ) {
        console.log('No batting data found.');
        return [];
      }
  
      // Extract the BattingData array
      const battingData = battingLeadersResult.Season.BattingDataCollection.BattingData;
  
      // Map the data into a more readable format
      const battingLeaders = battingData.map(player => ({
        playerName: `${player.Player?.attributes?.FirstName} ${player.Player?.attributes?.LastName}`,
        R: player.R // Extract the AVG field
      })).slice(0, 5);
  
      return battingLeaders;
    } catch (error) {
      console.error('Error fetching batting leaders:', error.message || error);
      return [];
    }
  }

  async function getBattingLeadersRBI(seasonID, category) {
    try {
      // Create the SOAP client
      const soapClient = await soap.createClientAsync(WEB_SERVICES);
  
      // Define the SOAP request parameters
      const soapData = {
        key: ACCESS_KEY,
        Category: category,
        SeasonID: seasonID,
        SeasonTypeID: "0"
      };
  
      // Make the SOAP request and await the response
      const [result] = await soapClient.GetBattingLeadersAsync(soapData);
  
      // Extract the result
      const battingLeadersResult = result?.GetBattingLeadersResult;
  
      if (
        !battingLeadersResult ||
        !battingLeadersResult.Season ||
        !battingLeadersResult.Season.BattingDataCollection ||
        !battingLeadersResult.Season.BattingDataCollection.BattingData
      ) {
        console.log('No batting data found.');
        return [];
      }
  
      // Extract the BattingData array
      const battingData = battingLeadersResult.Season.BattingDataCollection.BattingData;
  
      // Map the data into a more readable format
      const battingLeaders = battingData.map(player => ({
        playerName: `${player.Player?.attributes?.FirstName} ${player.Player?.attributes?.LastName}`,
        RBI: player.RBI // Extract the AVG field
      })).slice(0, 5);
  
      return battingLeaders;
    } catch (error) {
      console.error('Error fetching batting leaders:', error.message || error);
      return [];
    }
  }
  
  // Define the /batting-rbi endpoint
  app.get('/api/batting-rbi', async (req, res) => {
      const data = await getBattingLeadersRBI(368, "RBI");
  
      if (data.length === 0) {
        return res.status(404).json({ error: 'No batting leaders data found.' });
      }
  
      res.json({ battingLeaders: data });
   
  });
  
  // Define the /batting-r endpoint
  app.get('/api/batting-r', async (req, res) => {
      const data = await getBattingLeadersR(368, "R");
  
      if (data.length === 0) {
        return res.status(404).json({ error: 'No batting leaders data found.' });
      }
  
      res.json({ battingLeaders: data });
   
  });
  
  // Define the /batting-h endpoint
  app.get('/api/batting-h', async (req, res) => {
      const data = await getBattingLeadersH(368, "H");
  
      if (data.length === 0) {
        return res.status(404).json({ error: 'No batting leaders data found.' });
      }
  
      res.json({ battingLeaders: data });
   
  });
  
  // Define the /batting-avg endpoint
  app.get('/api/batting-avg', async (req, res) => {
      const data = await getBattingLeadersAVG(368, "AVG");
  
      if (data.length === 0) {
        return res.status(404).json({ error: 'No batting leaders data found.' });
      }
  
      res.json({ battingLeaders: data });
   
  });

  
  // Route to fetch pitching leaders by saves
  app.get('/api/pitching-s', async (req, res) => {
    const data = await getPitchingS(368); // Replace with dynamic seasonID if required
    if (data.length === 0) {
      return res.status(500).json({ error: 'Failed to fetch pitching saves data' });
    }
    res.json({pitchingLeaders: data}); // Respond with the fetched data
  });
  

  async function getPitchingW(seasonID) {
    try {
      // Create the SOAP client
      const soapClient = await soap.createClientAsync(WEB_SERVICES);
  
      // Define the parameters for the SOAP request
      const soapData = {
        key: ACCESS_KEY,
        Category: "W", // Fetching by Wins
        SeasonID: seasonID,
        SeasonTypeID: "0"
      };
  
      // Make the SOAP request
      const [result] = await soapClient.GetPitchingLeadersAsync(soapData);
  
      // Extract and validate the result
      const pitchingLeadersResult = result?.GetPitchingLeadersResult;
      if (
        !pitchingLeadersResult ||
        !pitchingLeadersResult.Season ||
        !pitchingLeadersResult.Season.PitchingDataCollection ||
        !pitchingLeadersResult.Season.PitchingDataCollection.PitchingData
      ) {
        console.log('No pitching data found.');
        return [];
      }
  
      // Map and return the top 5 pitching data for Wins
      const pitchingData = pitchingLeadersResult.Season.PitchingDataCollection.PitchingData;
      const winsData = pitchingData.map(player => ({
        playerName: `${player.Player?.attributes?.FirstName} ${player.Player?.attributes?.LastName}`,
        wins: player.W
      })).slice(0, 5); // Limit to top 5
  
      console.log('Top 5 Wins Data:', JSON.stringify(winsData, null, 2));
      return winsData;
  
    } catch (error) {
      console.error('Error fetching pitching wins leaders:', error.message || error);
      return [];
    }
  }

  // Function to fetch the schedule
  async function getSchedule(seasonID, seasonTypeID) {
    try {
      // Create the SOAP client
      const soapClient = await soap.createClientAsync(WEB_SERVICES);
  
      // Define the SOAP request parameters
      const soapData = {
        key: ACCESS_KEY,
        SeasonID: seasonID,
        SeasonTypeID: seasonTypeID,
      };
  
      // Make the SOAP request and await the response
      const [result] = await soapClient.GetScheduleAsync(soapData);
  
      // Extract the result
      const scheduleResult = result?.GetScheduleResult;
  
      if (!scheduleResult?.ScheduledGames?.ScheduledGame) {
        console.log('No schedule data found or data is not in the expected format.');
        return;
      }
  
      // Extract and process scheduled games
      const scheduledGames = scheduleResult.ScheduledGames.ScheduledGame;
      const scheduleDictionary = scheduledGames.map(game => {
        const innings = game?.Innings?.Inning || [];
        const inningTotals = innings.find(
          inning => inning.attributes?.Type === 'Totals'
        )?.attributes || {};
  
        return {
          Date: game.Date,
          FieldName: game.Field.attributes?.Name || 'Unknown',
          HomeTeam: game.HomeTeam.attributes?.Name || 'Unknown',
          AwayTeam: game.AwayTeam.attributes?.Name || 'Unknown',
          InningType: inningTotals.Type || 'Unknown',
          GameStatus: game.GameStatus || 'Unknown',
          Stats: {
            TopR: inningTotals.TopR || '0',
            TopH: inningTotals.TopH || '0',
            TopE: inningTotals.TopE || '0',
            BotR: inningTotals.BotR || '0',
            BotH: inningTotals.BotH || '0',
            BotE: inningTotals.BotE || '0',
          },
        };
      });
  
      // Log the dictionary
      return scheduleDictionary;
    } catch (error) {
      console.error('Error fetching schedule:', error.message || error);
    }
  }

  // Function to fetch the season batting data
  async function getSeasonBatting(seasonID, seasonTypeID) {
    try {
      // Create the SOAP client with SOAP 1.1 version
      const soapClient = await soap.createClientAsync(WEB_SERVICES, { version: soap.SOAP_1_1 });
  
      // Define the SOAP request parameters
      const soapData = {
        key: ACCESS_KEY,
        SeasonID: seasonID,
        SeasonTypeID: seasonTypeID,
      };
  
      // Define the SOAPAction header for GetSeasonBatting
      const headers = {
        SOAPAction: 'http://www.400Hitter.com/ws/DataService/GetSeasonBatting',
      };
  
      // Send the SOAP request with the headers and parameters
      const [result] = await soapClient.GetSeasonBattingAsync(soapData, headers);
  
      // Extract BattingData from the response
      const battingData = result?.GetSeasonBattingResult?.Season?.BattingDataCollection?.BattingData;
  
      if (!battingData) {
        console.log('No batting data found.');
        return {};
      }
  
      // Create a dictionary of team names and their statistics
      const teamStatsDictionary = battingData.map(team => {
        const teamName = team?.Team?.attributes?.Name || 'Unknown';
        const stats = {
          G: team?.G,
          AB: team?.AB,
          R: team?.R,
          H: team?.H,
          DB: team?.DB,
          TR: team?.TR,
          HR: team?.HR,
          RBI: team?.RBI,
          BB: team?.BB,
          SO: team?.SO,
          AVG: team?.AVG,
          OBP: team?.OBP,
          SLG: team?.SLG,
          OPS: team?.OPS,
          HBP: team?.HBP,
          SAC: team?.SAC,
          SB: team?.SB,
          CS: team?.CS,
          PO: team?.PO,
          A: team?.A,
          E: team?.E,
          FPC: team?.FPC,
        };
  
        return { [teamName]: stats };
      });
  
      // Return the dictionary
      return teamStatsDictionary;
  
    } catch (error) {
      console.error('Error fetching season batting data:', error.message || error);
      return {};
    }
  }

  // Function to fetch the season pitching data
  async function getSeasonPitching(seasonID, seasonTypeID) {
    try {
      // Create the SOAP client with SOAP 1.1 version
      const soapClient = await soap.createClientAsync(WEB_SERVICES, { version: soap.SOAP_1_1 });
  
      // Define the SOAP request parameters
      const soapData = {
        key: ACCESS_KEY,
        SeasonID: seasonID,
        SeasonTypeID: seasonTypeID,
      };
  
      // Define the SOAPAction header for GetSeasonPitching
      const headers = {
        SOAPAction: 'http://www.400Hitter.com/ws/DataService/GetSeasonPitching',
      };
  
      // Send the SOAP request with the headers and parameters
      const [result] = await soapClient.GetSeasonPitchingAsync(soapData, headers);
  
      // Extract PitchingData from the response
      const pitchingData = result?.GetSeasonPitchingResult?.Season?.PitchingDataCollection?.PitchingData;
  
      if (!pitchingData) {
        console.log('No pitching data found.');
        return {};
      }
  
      // Create a dictionary of team names and their pitching statistics
      const teamStatsDictionary = pitchingData.map(team => {
        const teamName = team?.Team?.attributes?.Name || 'Unknown';
        const stats = {
          G: team?.G,
          W: team?.W,
          L: team?.L,
          T: team?.T,
          S: team?.S,
          IP: team?.IP,
          H: team?.H,
          R: team?.R,
          ER: team?.ER,
          BB: team?.BB,
          SO: team?.SO,
          HR: team?.HR,
          HB: team?.HB,
          WP: team?.WP,
          BK: team?.BK,
          ERA9: team?.ERA9,
          ERA7: team?.ERA7,
          SOIP: team?.SOIP,
          WHIP: team?.WHIP,
        };
  
        return { [teamName]: stats };
      });
  
      // Return the dictionary
      return teamStatsDictionary;
  
    } catch (error) {
      console.error('Error fetching season pitching data:', error.message || error);
      return {};
    }
  }

  // Route to fetch pitching statistics
  app.get('/api/getPitchingStatistics', async (req, res) => {
    const data = await getSeasonPitching(368, "0"); // Replace with dynamic seasonID if required
    if (data.length === 0) {
      return res.status(500).json({ error: 'Failed to fetch pitching wins data' });
    }
    res.json({PitchingStatistics: data}); // Respond with the fetched data
  });

  // Route to fetch batting statistics
  app.get('/api/getBattingStatistics', async (req, res) => {
    const data = await getSeasonBatting(368, "0"); // Replace with dynamic seasonID if required
    if (data.length === 0) {
      return res.status(500).json({ error: 'Failed to fetch pitching wins data' });
    }
    res.json({BattingStatistics: data}); // Respond with the fetched data
  });

  // Route to fetch schedule
  app.get('/api/getSchedule', async (req, res) => {
    const data = await getSchedule(368, "1"); // Replace with dynamic seasonID if required
    if (data.length === 0) {
      return res.status(500).json({ error: 'Failed to fetch pitching wins data' });
    }
    res.json({Schedule: data}); // Respond with the fetched data
  });
  
  // Route to fetch pitching leaders by wins
  app.get('/api/pitching-w', async (req, res) => {
    const data = await getPitchingW(368); // Replace with dynamic seasonID if required
    if (data.length === 0) {
      return res.status(500).json({ error: 'Failed to fetch pitching wins data' });
    }
    res.json({pitchingLeaders: data}); // Respond with the fetched data
  });
  

// Route to fetch standings data
app.get('/api/standings', async (req, res) => {
  const data = await getStandings(368); // Example seasonID
  if (data.length === 0) {
    return res.status(500).json({ error: 'Failed to fetch standings data' });
  }
  res.json(data);
});

// Route to fetch pitching ERA7 leaders
app.get('/api/pitching-era7', async (req, res) => {
  const data = await getPitchingERA7(368); // Example seasonID
  if (data.length === 0) {
    return res.status(500).json({ error: 'Failed to fetch pitching ERA7 data' });
  }
  res.json({pitchingLeaders: data});
});


  // Route to fetch pitching WHIP leaders
  app.get('/api/pitching-whip', async (req, res) => {
    const data = await getPitchingWHIP(368); // Example seasonID
    if (data.length === 0) {
      return res.status(500).json({ error: 'Failed to fetch pitching WHIP data' });
    }
    res.json({pitchingLeaders: data});
  });




// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
