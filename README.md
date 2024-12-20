# carbon-market
Here’s an extended version of the **README.md** file with a more detailed description and additional information about the project’s purpose, features, and usage.

---

# Carbon Offset Project Auction Platform

This project serves as a frontend application for a carbon credit marketplace, allowing users to browse, view, and eventually participate in auctions for carbon offset projects. Each project (referred to as an "auction") represents a unique carbon offset opportunity, such as reforestation or land preservation, aimed at reducing greenhouse gas emissions.

By showcasing available projects, this platform empowers users to explore various offset options and invest in sustainability initiatives that contribute to environmental conservation. This application also features a dynamic, user-friendly interface that provides essential information on each auction, including project title, description, available carbon credits, and auction timeline.

## Project Objectives

The carbon offset project auction platform addresses several key objectives:

1. **Transparency**: Allowing users to see project details at a glance, from satellite images to carbon credit estimates, ensures transparency around offset opportunities.
2. **User Engagement**: Presenting project information in an intuitive format encourages user engagement and makes complex sustainability data accessible.
3. **Marketplace Accessibility**: By connecting users with offset projects, this platform serves as a bridge between carbon-conscious investors and environmental projects that need support.

## Key Features

### Auction Listing with Satellite Image Display
Each auction is represented by a detailed card component displaying key information such as:
   - Project title and description for context.
   - Satellite image showcasing the specific area under conservation.
   - Carbon credits available for the project, indicating its environmental impact.
   - Start and end dates for the auction, providing a timeline for potential investors.

### Dynamic Loading & Error Handling
The application includes a dynamic loading feature to inform users when data is being fetched from the backend. If no offset projects are available, the platform displays a user-friendly message to indicate that no auctions are currently listed.

### Responsive Grid Layout
The platform utilizes a grid-based layout, ensuring that projects are displayed in a visually appealing and organized way across various screen sizes, from mobile devices to large desktop monitors.

---

## File Structure and Component Overview

- **AuctionCard**: This component is responsible for displaying each auction project in a visually structured card format, which includes:
   - The project’s title, description, and carbon credits.
   - Satellite image pulled from Google Maps API for location context.
   - Auction timeline and creator information.
   - Placeholder for additional information as blockchain integration is added.

- **AuctionList**: The main component responsible for:
   - Fetching the list of auctions from the backend.
   - Displaying the list of `AuctionCard` components.
   - Showing loading or "no projects available" messages based on data availability.

---

## Installation and Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-repo-name.git
   cd your-repo-name
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Backend Setup**:
   - Ensure the backend API is running and accessible at `http://localhost:8000`.
   - The backend should be configured to retrieve auction data from MongoDB and provide it to the frontend via the `/auctions` endpoint.

4. **Environment Variables**:
   - Create a `.env` file in the root directory and specify the backend API URL for frontend requests:

     ```env
     NEXT_PUBLIC_BACKEND_API=http://localhost:8000
     ```

### Usage

1. **Starting the Application**:
   Run the application locally:
   ```bash
   npm run dev
   ```

2. **Access the Application**:
   Open your browser and navigate to `http://localhost:3000`. You should see a list of available carbon offset projects (if any exist) displayed in a grid layout.

3. **Auction Viewing**:
   - If there are auctions available, each auction will be displayed in a card format with relevant details.
   - If no auctions are available, a message will indicate that no carbon offset projects are currently listed.

---

## Components in Detail

### AuctionList Component
The `AuctionList` component is responsible for managing the auction display. It handles data fetching, conditional rendering based on data availability, and state management to provide a smooth user experience.

   - **Data Fetching**: Retrieves auction data from the backend API (`/auctions` endpoint).
   - **Conditional Rendering**: While data is loading, it shows a loading indicator. If no projects are available, it displays a message indicating the absence of carbon offset projects.
   - **Grid Layout**: Organizes the `AuctionCard` components in a responsive grid format.

### AuctionCard Component
The `AuctionCard` component displays information for a single auction project. Each card provides:
   - **Project Title and Description**: Offers a summary of the offset project, helping users understand the purpose of the auction.
   - **Carbon Credits**: Displays the amount of carbon credits available, giving users insight into the project’s environmental impact.
   - **Auction Timeline**: Shows the remaining time for the auction, calculated based on the start and end dates stored in the database.
   - **Satellite Image**: Provides visual context to the project, displaying an image of the conservation area or project location.

---

## Dependencies

- **React**: JavaScript library for building the frontend user interface.
- **Next.js**: Framework for server-side rendering and static site generation, optimizing performance.
- **Tailwind CSS**: Utility-first CSS framework for styling and responsive design.
- **MongoDB**: NoSQL database used to store auction project details.
- **FastAPI**: Python-based backend API for retrieving and managing auction data (configured in the backend repository).
- **Axios**: HTTP client for making API requests to the backend.
- **React Query**: Library for data fetching, caching, and state management in React applications.
- **celo-connect**: JavaScript library for connecting to the Celo blockchain, providing a secure and user-friendly interface for interacting with the blockchain.
- **@celo/contractkit**: JavaScript library for interacting with the Celo blockchain, providing a set of tools for interacting with smart contracts and managing user accounts.
- **@celo/utils**: Utility library for common Celo-related functions, including address formatting and signature verification.


---

## Future Enhancements

1. **Blockchain Integration**:
   - Implement smart contracts to handle bidding, verification, and ownership of carbon credits on the blockchain.
   - Enable users to make real-time bids on auctions directly through the blockchain, enhancing transparency and trust in the system.

2. **User Authentication**:
   - Add user authentication to allow registered users to create new projects, bid on existing projects, and view their own project history.
   - Implement user profiles to store and display user-specific information, including bid history and project ownership.

3. **Advanced Filtering and Search**:
   - Provide options to filter auctions by various criteria (e.g., project location, carbon credits available) to help users find projects that align with their sustainability goals.

4. **Enhanced Notifications**:
   - Implement notification alerts for key events, such as when new auctions are listed or an auction is nearing its end.

5. **Expanded Data Visualization**:
   - Introduce charts and graphs to visualize auction trends, carbon credits available, and other key metrics, providing users with a data-driven view of the carbon offset marketplace.

---

## Contributing

1. **Fork the Repository**.
2. **Create a Feature Branch**:
   ```bash
   git checkout -b feature-branch
   ```
3. **Commit Changes**:
   ```bash
   git commit -m "Add new feature"
   ```
4. **Push to the Branch**:
   ```bash
   git push origin feature-branch
   ```
5. **Open a Pull Request**.

---

## License

This project is licensed under the MIT License. Please refer to the `LICENSE` file for more information.

---

## Contact

For support or contributions, please reach out to the project maintainer at [jtalukwe@kabarak.ac.ke](mailto:jtalukwe@kabarak.ac.ke).

---
