import './ProfileAvatar.css';

export default function ProfileAvatar(props) {
  const backgroundImage = `url("https://assets.gsdcandacorp.info/avatars/${props.id}.jpeg")`;
  const styles = {
    backgroundImage: backgroundImage,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };

  return (
    <div 
      className="profile-avatar"
      style={styles}
    ></div>
  );
}