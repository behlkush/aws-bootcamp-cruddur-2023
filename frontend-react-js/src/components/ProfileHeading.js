import './ProfileHeading.css';
import EditProfileButton from '../components/EditProfileButton';
import ProfileAvatar from './ProfileAvatar';

export default function ProfileHeading(props) {
  const backgroundImage = 'url("https://assets.gsdcanadacorp.info/banners/banner.jpeg")';
  console.log('kb is here2', props.profile.cognito_user_uuid)
  const styles = {
    backgroundImage: backgroundImage,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
  return (
    <div className='activity_feed_heading profile_heading'>
      <div className='title'>{props.profile.display_name}</div>
      <div className="cruds_count">{props.profile.cruds_count} Cruds</div>
      <div className="banner" style={styles} >
        {props.profile.cognito_user_uuid}
        <ProfileAvatar id={props.profile.cognito_user_uuid} />
      </div>
      <div className="info">
        <div className='id'>
          <div className="display_name">{props.profile.display_name}</div>
          <div className="handle">@{props.profile.handle}</div>
        </div>
        <EditProfileButton setPopped={props.setPopped} />
      </div>
      <div className="bio">{props.profile.bio}</div>
    </div>
  );
}